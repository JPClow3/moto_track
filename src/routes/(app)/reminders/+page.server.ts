import type { Sql } from "postgres";
import { featureActions, loadFeature } from "$server/domain/crud";

type ReminderRow = {
  motorcycle_id: string | null;
  title: string;
  is_recurring: boolean;
  trigger_type: string;
  reference_km: number | null;
  reference_date: string | null;
};

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// The Supabase version embedded `motorcycles(current_odometer_km)` in the
// same select and relied on that table's own RLS to keep the embed
// owner-scoped. With RLS gone, look the motorcycle up as its own owner-scoped
// query instead of trusting the reminder's `motorcycle_id` column alone.
async function currentOdometerFor(
  db: Sql,
  ownerId: string,
  motorcycleId: string | null,
) {
  if (!motorcycleId) return 0;
  const [motorcycle] = await db<Array<{ current_odometer_km: number | null }>>`
    select current_odometer_km from motorcycles
    where id = ${motorcycleId} and owner_id = ${ownerId}
  `;
  return Number(motorcycle?.current_odometer_km ?? 0);
}

const baseActions = featureActions("reminders");

export const actions = {
  ...baseActions,
  snoozeDays: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const days = Math.max(Number(form.get("days") ?? 7), 0);
    const ownerId = locals.user!.id;

    let reminder: { reference_date: string | null } | undefined;
    try {
      [reminder] = await locals.db<Array<{ reference_date: string | null }>>`
        select reference_date from reminders
        where id = ${id} and owner_id = ${ownerId}
      `;
    } catch (err) {
      return { ok: false, message: messageFrom(err) };
    }
    if (!reminder) return { ok: false, message: "Lembrete não encontrado." };

    const base = reminder.reference_date
      ? new Date(`${reminder.reference_date}T00:00:00`)
      : new Date();
    base.setDate(base.getDate() + days);

    try {
      await locals.db`
        update reminders
        set reference_date = ${base.toISOString().slice(0, 10)},
          last_notified_at = null,
          last_email_notified_at = null,
          last_push_notified_at = null
        where id = ${id} and owner_id = ${ownerId}
      `;
    } catch (err) {
      return { ok: false, message: messageFrom(err) };
    }
    return { ok: true };
  },
  snoozeKm: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const km = Math.max(Number(form.get("km") ?? 500), 0);
    const ownerId = locals.user!.id;

    let reminder:
      { reference_km: number | null; motorcycle_id: string | null } | undefined;
    try {
      [reminder] = await locals.db<
        Array<{ reference_km: number | null; motorcycle_id: string | null }>
      >`
        select reference_km, motorcycle_id from reminders
        where id = ${id} and owner_id = ${ownerId}
      `;
    } catch (err) {
      return { ok: false, message: messageFrom(err) };
    }
    if (!reminder) return { ok: false, message: "Lembrete não encontrado." };

    const current = await currentOdometerFor(
      locals.db,
      ownerId,
      reminder.motorcycle_id,
    );
    const base = Number(reminder.reference_km ?? current);

    try {
      await locals.db`
        update reminders
        set reference_km = ${base + km},
          last_notified_at = null,
          last_email_notified_at = null,
          last_push_notified_at = null
        where id = ${id} and owner_id = ${ownerId}
      `;
    } catch (err) {
      return { ok: false, message: messageFrom(err) };
    }
    return { ok: true };
  },
  complete: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const ownerId = locals.user!.id;

    let reminder: ReminderRow | undefined;
    try {
      [reminder] = await locals.db<ReminderRow[]>`
        select motorcycle_id, title, is_recurring, trigger_type,
          reference_km, reference_date
        from reminders
        where id = ${id} and owner_id = ${ownerId}
      `;
    } catch (err) {
      return { ok: false, message: messageFrom(err) };
    }
    if (!reminder) return { ok: false, message: "Lembrete não encontrado." };

    const today = new Date().toISOString().slice(0, 10);
    const currentOdometer = await currentOdometerFor(
      locals.db,
      ownerId,
      reminder.motorcycle_id,
    );

    try {
      await locals.db`
        insert into maintenance_records ${locals.db({
          owner_id: ownerId,
          motorcycle_id: reminder.motorcycle_id,
          maintenance_type: "other",
          date: today,
          odometer_km: currentOdometer,
          description: reminder.title,
          cost_cents: 0,
        })}
      `;
    } catch (err) {
      return { ok: false, message: messageFrom(err) };
    }

    const update = reminder.is_recurring
      ? {
          reference_km: ["by_km", "by_interval"].includes(reminder.trigger_type)
            ? currentOdometer
            : reminder.reference_km,
          reference_date: ["by_date", "by_interval"].includes(
            reminder.trigger_type,
          )
            ? today
            : reminder.reference_date,
          last_notified_at: null,
          last_email_notified_at: null,
          last_push_notified_at: null,
        }
      : { is_active: false };

    try {
      await locals.db`
        update reminders
        set ${locals.db(update)}
        where id = ${id} and owner_id = ${ownerId}
      `;
    } catch (err) {
      return { ok: false, message: messageFrom(err) };
    }
    return { ok: true };
  },
};

export async function load({ locals }) {
  return loadFeature(locals.db, "reminders", locals.user!);
}
