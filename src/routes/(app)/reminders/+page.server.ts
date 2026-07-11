import { featureActions, loadFeature } from "$server/domain/crud";

const baseActions = featureActions("reminders");

export const actions = {
  ...baseActions,
  snoozeDays: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const days = Math.max(Number(form.get("days") ?? 7), 0);
    const { data: reminder, error: readError } = await locals.supabase
      .from("reminders")
      .select("reference_date")
      .eq("id", id)
      .eq("owner_id", locals.user!.id)
      .maybeSingle();
    if (readError || !reminder)
      return {
        ok: false,
        message: readError?.message ?? "Lembrete não encontrado.",
      };
    const base = reminder.reference_date
      ? new Date(`${reminder.reference_date}T00:00:00`)
      : new Date();
    base.setDate(base.getDate() + days);
    const { error } = await locals.supabase
      .from("reminders")
      .update({
        reference_date: base.toISOString().slice(0, 10),
        last_notified_at: null,
        last_email_notified_at: null,
        last_push_notified_at: null,
      })
      .eq("id", id)
      .eq("owner_id", locals.user!.id);
    return error ? { ok: false, message: error.message } : { ok: true };
  },
  snoozeKm: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const km = Math.max(Number(form.get("km") ?? 500), 0);
    const { data: reminder, error: readError } = await locals.supabase
      .from("reminders")
      .select("reference_km, motorcycles(current_odometer_km)")
      .eq("id", id)
      .eq("owner_id", locals.user!.id)
      .maybeSingle();
    if (readError || !reminder)
      return {
        ok: false,
        message: readError?.message ?? "Lembrete não encontrado.",
      };
    const row = reminder as unknown as {
      reference_km?: number | null;
      motorcycles?: { current_odometer_km?: number | null } | null;
    };
    const current = Number(row.motorcycles?.current_odometer_km ?? 0);
    const base = Number(row.reference_km ?? current);
    const { error } = await locals.supabase
      .from("reminders")
      .update({
        reference_km: base + km,
        last_notified_at: null,
        last_email_notified_at: null,
        last_push_notified_at: null,
      })
      .eq("id", id)
      .eq("owner_id", locals.user!.id);
    return error ? { ok: false, message: error.message } : { ok: true };
  },
  complete: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const { data: reminder, error: readError } = await locals.supabase
      .from("reminders")
      .select("*, motorcycles(current_odometer_km)")
      .eq("id", id)
      .eq("owner_id", locals.user!.id)
      .maybeSingle();
    if (readError || !reminder)
      return {
        ok: false,
        message: readError?.message ?? "Lembrete não encontrado.",
      };
    const row = reminder as unknown as {
      motorcycle_id?: string | null;
      title: string;
      is_recurring: boolean;
      trigger_type: string;
      reference_km?: number | null;
      reference_date?: string | null;
      motorcycles?: { current_odometer_km?: number | null } | null;
    };
    const today = new Date().toISOString().slice(0, 10);
    const currentOdometer = Number(row.motorcycles?.current_odometer_km ?? 0);
    await locals.supabase.from("maintenance_records").insert({
      owner_id: locals.user!.id,
      motorcycle_id: row.motorcycle_id ?? null,
      maintenance_type: "other",
      date: today,
      odometer_km: currentOdometer,
      description: row.title,
      cost_cents: 0,
    });
    const update = row.is_recurring
      ? {
          reference_km: ["by_km", "by_interval"].includes(row.trigger_type)
            ? currentOdometer
            : row.reference_km,
          reference_date: ["by_date", "by_interval"].includes(row.trigger_type)
            ? today
            : row.reference_date,
          last_notified_at: null,
          last_email_notified_at: null,
          last_push_notified_at: null,
        }
      : { is_active: false };
    const { error } = await locals.supabase
      .from("reminders")
      .update(update)
      .eq("id", id)
      .eq("owner_id", locals.user!.id);
    return error ? { ok: false, message: error.message } : { ok: true };
  },
};

export async function load({ locals }) {
  return loadFeature(locals.supabase, "reminders", locals.user!);
}
