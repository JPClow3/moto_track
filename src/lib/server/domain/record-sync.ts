import type { Sql } from "postgres";
import { assertCanCreateReminder } from "$server/domain/entitlement-guards";
import { isoDateValue } from "$server/domain/date-value";
import { nextScheduleMilestone } from "$server/domain/maintenance-schedule";

export type LinkedReminder = {
  title: string;
  trigger_type: "by_km" | "by_date" | "by_interval";
  trigger_value_km: number | null;
  trigger_value_days: number | null;
  reference_km: number | null;
  reference_date: string | null;
  is_recurring: boolean;
};

type RecordPayload = Record<string, unknown>;

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function odometerValue(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return stringValue(value);
}

export function subtractDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

export function reminderForRecord(
  table: string,
  _recordId: string,
  payload: RecordPayload,
): LinkedReminder | null {
  if (!stringValue(payload.motorcycle_id)) return null;

  if (table === "maintenance_records") {
    const intervalKm = numberValue(payload.interval_km);
    const intervalDays = numberValue(payload.interval_days);
    const referenceKm = odometerValue(payload.odometer_km);
    const referenceDate = dateValue(payload.date);
    if (!intervalKm && !intervalDays) return null;
    return {
      title: `Manutenção: ${stringValue(payload.maintenance_type) ?? "revisão"}`,
      trigger_type:
        intervalKm && intervalDays
          ? "by_interval"
          : intervalKm
            ? "by_km"
            : "by_date",
      trigger_value_km: intervalKm,
      trigger_value_days: intervalDays,
      reference_km: referenceKm,
      reference_date: referenceDate,
      is_recurring: true,
    };
  }

  const isDocument = table === "motorcycle_documents";
  const isFee = table === "annual_fees";
  if (!isDocument && !isFee) return null;
  const dueDate = dateValue(payload[isDocument ? "valid_until" : "due_date"]);
  const noticeDays = numberValue(payload.notify_before_days) ?? 30;
  if (!dueDate) return null;
  return {
    title: isDocument
      ? `Documento vence: ${stringValue(payload.name) ?? "documento"}`
      : `Taxa vence: ${stringValue(payload.fee_type) ?? "taxa"}`,
    trigger_type: "by_date",
    trigger_value_km: null,
    trigger_value_days: 0,
    reference_km: null,
    reference_date: subtractDays(dueDate, noticeDays),
    is_recurring: false,
  };
}

// Shared owner+marker upsert for every auto-linked reminder (record-linked,
// insurance-linked, maintenance-plan-linked). postgres.js throws on query
// failure, so callers just let the exception bubble rather than checking an
// explicit `{ error }`, matching how this file always worked.
async function upsertMarkedReminder(
  db: Sql,
  ownerId: string,
  marker: string,
  values: Record<string, unknown>,
  { failOnCap = false }: { failOnCap?: boolean } = {},
) {
  const [existing] = await db<{ id: string }[]>`
    select id from reminders
    where owner_id = ${ownerId} and notes = ${marker}
  `;

  if (existing) {
    await db`
      update reminders
      set ${db(values)}
      where id = ${existing.id} and owner_id = ${ownerId}
    `;
    return { ok: true as const, created: false };
  }

  // Auto-linked creates should not blow past Free caps; by default skip
  // rather than fail the parent record save. Explicit user actions (saving
  // an insurance policy or a maintenance plan) opt into `failOnCap` so the
  // cap is surfaced instead of silently dropped.
  const blocked = await assertCanCreateReminder(db, ownerId);
  if (blocked) {
    if (failOnCap) return { ok: false as const, message: blocked };
    return { ok: true as const, created: false, skipped: true as const };
  }

  await db`
    insert into reminders ${db(values)}
  `;
  return { ok: true as const, created: true };
}

export async function syncLinkedReminder(
  db: Sql,
  ownerId: string,
  table: string,
  recordId: string,
  payload: RecordPayload,
) {
  const marker = `auto:${table}:${recordId}`;
  let reminder = reminderForRecord(table, recordId, payload);
  if (table === "maintenance_records" && payload.motorcycle_id) {
    const [plan] = await db<Array<{ id: string }>>`
      select id from maintenance_plan_items
      where owner_id = ${ownerId} and motorcycle_id = ${String(payload.motorcycle_id)}
        and lower(btrim(maintenance_type)) = lower(btrim(${String(payload.maintenance_type ?? "")}))
        and is_active = true
      limit 1
    `;
    // The plan is reconciled by the record's transaction. Keeping one reminder
    // per receipt as well would continue to notify for obsolete services.
    if (plan) reminder = null;
  }

  if (!reminder) {
    const [existing] = await db<{ id: string }[]>`
      select id from reminders
      where owner_id = ${ownerId} and notes = ${marker}
    `;
    if (existing) {
      await db`
        delete from reminders
        where id = ${existing.id} and owner_id = ${ownerId}
      `;
    }
    return;
  }

  const values = {
    owner_id: ownerId,
    motorcycle_id: String(payload.motorcycle_id),
    ...reminder,
    send_email: true,
    send_push: true,
    is_active: true,
    notes: marker,
  };

  await upsertMarkedReminder(db, ownerId, marker, values);
}

export type InsurancePolicyReminderInput = {
  id: string;
  motorcycle_id: string;
  provider: string;
  coverage_end: string;
  notify_before_days: number;
};

export async function syncInsuranceReminder(
  db: Sql,
  ownerId: string,
  policy: InsurancePolicyReminderInput,
) {
  const marker = `insurance:${policy.id}`;
  const noticeDays = policy.notify_before_days ?? 30;
  const values = {
    owner_id: ownerId,
    motorcycle_id: policy.motorcycle_id,
    title: `Seguro: ${policy.provider}`,
    trigger_type: "by_date" as const,
    trigger_value_days: 0,
    reference_date: subtractDays(policy.coverage_end, noticeDays),
    is_active: true,
    send_email: true,
    send_push: true,
    notes: marker,
    updated_at: new Date().toISOString(),
  };
  return upsertMarkedReminder(db, ownerId, marker, values, {
    failOnCap: true,
  });
}

export async function clearInsuranceReminder(
  db: Sql,
  ownerId: string,
  policyId: string,
) {
  await db`
    delete from reminders
    where owner_id = ${ownerId} and notes = ${`insurance:${policyId}`}
  `;
}

export async function syncPlanReminder(
  db: Sql,
  ownerId: string,
  plan: {
    id: string;
    motorcycle_id: string;
    maintenance_type: string;
    interval_km: number | null;
    interval_days: number | null;
    reference_km?: number | null;
  },
) {
  const [history] = await db<
    Array<{
      last_done_km: number | null;
      last_done_date: unknown;
      is_active: boolean;
      schedule_milestones: unknown;
      recurrence_km: number | null;
      recurrence_months: number | null;
      last_completed_milestone: number | null;
      in_service_date: unknown;
      calendar_anchor_mode: "in_service" | "last_service";
    }>
  >`
    select p.last_done_km, p.last_done_date, p.is_active, p.schedule_milestones,
      p.recurrence_km, p.recurrence_months, p.last_completed_milestone, m.in_service_date,
      p.calendar_anchor_mode
    from maintenance_plan_items p
    join motorcycles m on m.id = p.motorcycle_id and m.owner_id = p.owner_id
    where p.id = ${plan.id} and p.owner_id = ${ownerId}
  `;
  if (!history) return { ok: false as const, message: "Plano não encontrado." };
  const phase = nextScheduleMilestone({
    milestones: history.schedule_milestones,
    recurrenceKm: history.recurrence_km,
    recurrenceMonths: history.recurrence_months,
    completedMilestone: history.last_completed_milestone,
    inServiceDate: history.in_service_date,
    calendarAnchorMode: history.calendar_anchor_mode,
    lastServiceDate: history.last_done_date,
  });
  const [existing] = await db<{ id: string; is_active: boolean }[]>`
    select id, is_active from reminders
    where owner_id = ${ownerId} and linked_plan_item_id = ${plan.id}
  `;

  const values = {
    owner_id: ownerId,
    motorcycle_id: plan.motorcycle_id,
    title: `Plano: ${plan.maintenance_type}`,
    trigger_type: (phase || (plan.interval_km && plan.interval_days)
      ? "by_interval"
      : plan.interval_km
        ? "by_km"
        : "by_date") as "by_interval" | "by_km" | "by_date",
    trigger_value_km: phase ? phase.dueKm : plan.interval_km,
    trigger_value_days: phase ? 0 : plan.interval_days,
    reference_km: phase
      ? phase.dueKm === null
        ? null
        : 0
      : (history.last_done_km ?? null),
    reference_date: phase
      ? phase.dueDate
      : history.last_done_date
        ? isoDateValue(history.last_done_date)
        : null,
    is_active: history.is_active,
    is_recurring: true,
    linked_plan_item_id: plan.id,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await db`
      update reminders
      set ${db({ ...values, is_active: history.is_active && existing.is_active })}
      where id = ${existing.id} and owner_id = ${ownerId}
    `;
    await clearSupersededRecordReminders(db, ownerId, plan);
    return { ok: true as const };
  }

  const blocked = await assertCanCreateReminder(db, ownerId);
  if (blocked) return { ok: false as const, message: blocked };

  await db`
    insert into reminders ${db({ ...values, send_email: true, send_push: true })}
  `;
  await clearSupersededRecordReminders(db, ownerId, plan);
  return { ok: true as const };
}

async function clearSupersededRecordReminders(
  db: Sql,
  ownerId: string,
  plan: { motorcycle_id: string; maintenance_type: string },
) {
  await db`
    delete from reminders r using maintenance_records m
    where r.owner_id = ${ownerId} and m.owner_id = ${ownerId}
      and r.notes = 'auto:maintenance_records:' || m.id::text
      and m.motorcycle_id = ${plan.motorcycle_id}
      and lower(btrim(m.maintenance_type)) = lower(btrim(${plan.maintenance_type}))
  `;
}
