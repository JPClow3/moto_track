import type { Sql } from "postgres";
import { assertCanCreateReminder } from "$server/domain/entitlement-guards";

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

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function subtractDays(date: string, days: number) {
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
    const referenceKm = numberValue(payload.odometer_km);
    const referenceDate = stringValue(payload.date);
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
  const dueDate = stringValue(payload[isDocument ? "valid_until" : "due_date"]);
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
  const reminder = reminderForRecord(table, recordId, payload);

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
  const values = {
    owner_id: ownerId,
    motorcycle_id: policy.motorcycle_id,
    title: `Seguro: ${policy.provider}`,
    trigger_type: "by_date" as const,
    trigger_value_days: policy.notify_before_days,
    reference_date: policy.coverage_end,
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
  },
) {
  const [existing] = await db<{ id: string }[]>`
    select id from reminders
    where owner_id = ${ownerId} and linked_plan_item_id = ${plan.id}
  `;

  const values = {
    owner_id: ownerId,
    motorcycle_id: plan.motorcycle_id,
    title: `Plano: ${plan.maintenance_type}`,
    trigger_type: (plan.interval_km ? "by_interval" : "by_date") as
      "by_interval" | "by_date",
    trigger_value_km: plan.interval_km,
    trigger_value_days: plan.interval_days,
    is_active: true,
    send_email: true,
    send_push: true,
    linked_plan_item_id: plan.id,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await db`
      update reminders
      set ${db(values)}
      where id = ${existing.id} and owner_id = ${ownerId}
    `;
    return { ok: true as const };
  }

  const blocked = await assertCanCreateReminder(db, ownerId);
  if (blocked) return { ok: false as const, message: blocked };

  await db`
    insert into reminders ${db(values)}
  `;
  return { ok: true as const };
}
