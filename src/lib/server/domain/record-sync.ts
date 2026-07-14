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

export async function syncLinkedReminder(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  table: string,
  recordId: string,
  payload: RecordPayload,
) {
  const marker = `auto:${table}:${recordId}`;
  const reminder = reminderForRecord(table, recordId, payload);
  const { data: existing, error: readError } = await supabase
    .from("reminders")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("notes", marker)
    .maybeSingle();
  if (readError) throw readError;

  if (!reminder) {
    if (existing) {
      const { error } = await supabase
        .from("reminders")
        .delete()
        .eq("id", existing.id)
        .eq("owner_id", ownerId);
      if (error) throw error;
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
  const { error } = existing
    ? await supabase
        .from("reminders")
        .update(values)
        .eq("id", existing.id)
        .eq("owner_id", ownerId)
    : await supabase.from("reminders").insert(values);
  if (error) throw error;
}
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database";
