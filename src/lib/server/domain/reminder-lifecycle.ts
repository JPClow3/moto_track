import type { Sql } from "postgres";
import { addCalendarDays, validDate } from "./maintenance-forecast";
import { syncMotorcycleOdometer } from "./odometer";
import { lockObjectOwner } from "../db/owner-lock";
import {
  scheduleMilestones,
  relativeReplacementMonths,
} from "./maintenance-schedule";

import { appToday } from "../../utils/calendar-day";
type CompletionRow = {
  id: string;
  motorcycle_id: string | null;
  title: string;
  is_active: boolean;
  is_recurring: boolean;
  linked_plan_item_id: string | null;
  notes: string;
  completion_version: number;
};

export function snoozeDateTarget(today: string, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 365)
    throw new Error("Informe um adiamento entre 1 e 365 dias.");
  const target = addCalendarDays(today, days);
  if (!target) throw new Error("Data inválida para adiamento.");
  return target;
}

export function snoozeKmTarget(currentKm: number, km: number) {
  if (
    !Number.isInteger(km) ||
    km < 1 ||
    km > 100_000 ||
    !Number.isInteger(currentKm) ||
    currentKm < 0 ||
    currentKm + km > 2_147_483_647
  )
    throw new Error("Informe um adiamento válido em quilômetros.");
  return currentKm + km;
}

/** Only the rendered version can record a completion; retries cannot duplicate it. */
export async function completeReminder(
  db: Sql,
  ownerId: string,
  reminderId: string,
  expectedVersion: number,
  today = appToday(),
) {
  if (
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0 ||
    !validDate(today)
  )
    throw new Error("Atualize a página antes de concluir o lembrete.");
  return db.begin(async (transaction) => {
    const tx = transaction as unknown as Sql;
    // Same owner lock used by record/object writes; completion and its receipt
    // must commit together, including the plan trigger's history reconciliation.
    await lockObjectOwner(tx, ownerId);
    await tx`select id from profiles where id = ${ownerId} for update`;
    const [reminder] = await tx<CompletionRow[]>`
      select id, motorcycle_id, title, is_active, is_recurring,
        linked_plan_item_id, notes, completion_version
      from reminders where id = ${reminderId} and owner_id = ${ownerId}
      for update
    `;
    if (!reminder) throw new Error("Lembrete não encontrado.");
    if (!reminder.is_active || reminder.completion_version !== expectedVersion)
      throw new Error("Atualize a página antes de concluir o lembrete.");

    let currentKm: number | null = null;
    if (reminder.motorcycle_id) {
      const [motorcycle] = await tx<Array<{ current_odometer_km: number }>>`
        select current_odometer_km from motorcycles
        where id = ${reminder.motorcycle_id} and owner_id = ${ownerId}
          and deleted_at is null and is_active = true
      `;
      if (!motorcycle) throw new Error("Moto não encontrada.");
      currentKm = Number(motorcycle.current_odometer_km ?? 0);
    }

    let maintenanceType: string | null = null;
    let completedMilestone: number | null = null;
    if (reminder.linked_plan_item_id) {
      const [plan] = await tx<
        Array<{
          maintenance_type: string;
          schedule_milestones: unknown;
          last_completed_milestone: number | null;
          recurrence_km: number | null;
          recurrence_months: number | null;
          calendar_anchor_mode: string;
        }>
      >`
        select maintenance_type, schedule_milestones, last_completed_milestone,
          recurrence_km, recurrence_months, calendar_anchor_mode from maintenance_plan_items
        where id = ${reminder.linked_plan_item_id} and owner_id = ${ownerId}
          and motorcycle_id = ${reminder.motorcycle_id} and is_active = true
      `;
      if (!plan) throw new Error("Plano de manutenção não encontrado.");
      maintenanceType = plan.maintenance_type;
      if (scheduleMilestones(plan.schedule_milestones).length) {
        const relative =
          relativeReplacementMonths({
            milestones: plan.schedule_milestones,
            recurrenceKm: plan.recurrence_km,
            recurrenceMonths: plan.recurrence_months,
            calendarAnchorMode: plan.calendar_anchor_mode,
          }) !== null;
        if (plan.last_completed_milestone === null && !relative)
          throw new Error(
            "Confirme a última etapa de revisão na página Manutenção antes de concluir.",
          );
        completedMilestone =
          plan.last_completed_milestone === null
            ? null
            : plan.last_completed_milestone + 1;
      }
    } else if (reminder.notes.startsWith("auto:maintenance_records:")) {
      const recordId = reminder.notes.slice("auto:maintenance_records:".length);
      const [record] = await tx<Array<{ maintenance_type: string }>>`
        select maintenance_type from maintenance_records
        where id = ${recordId} and owner_id = ${ownerId}
          and motorcycle_id = ${reminder.motorcycle_id}
      `;
      maintenanceType = record?.maintenance_type ?? null;
    } else if (
      !reminder.notes.startsWith("auto:") &&
      !reminder.notes.startsWith("insurance:")
    ) {
      maintenanceType = "other";
    }
    if (maintenanceType && reminder.motorcycle_id && currentKm !== null) {
      await tx`
        insert into maintenance_records ${tx({
          owner_id: ownerId,
          motorcycle_id: reminder.motorcycle_id,
          maintenance_type: maintenanceType,
          date: today,
          odometer_km: currentKm,
          description: reminder.title,
          cost_cents: 0,
          maintenance_plan_item_id: reminder.linked_plan_item_id,
          completed_milestone: completedMilestone,
        })}
      `;
      await syncMotorcycleOdometer(tx, ownerId, reminder.motorcycle_id);
    }
    await tx`
      update reminders set ${tx({
        ...(reminder.is_recurring
          ? reminder.linked_plan_item_id
            ? {}
            : { reference_km: currentKm, reference_date: today }
          : { is_active: false }),
        snoozed_until_date: null,
        snoozed_until_km: null,
        last_notified_at: null,
        last_email_notified_at: null,
        last_push_notified_at: null,
        completion_version: expectedVersion + 1,
        updated_at: new Date().toISOString(),
      })}
      where id = ${reminderId} and owner_id = ${ownerId}
    `;
    return { ok: true as const, alreadyCompleted: false };
  });
}
