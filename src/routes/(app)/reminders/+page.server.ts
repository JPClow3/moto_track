import { localizedActions } from "$server/domain/localized-actions";
import type { Sql } from "postgres";
import { featureActions, loadFeature } from "$server/domain/crud";
import { fail } from "@sveltejs/kit";
import { siteUrl } from "$server/env";
import { shareTokenHash } from "$server/domain/sale-report-share";
import { lockObjectOwner } from "$server/db/owner-lock";
import {
  completeReminder,
  snoozeDateTarget,
  snoozeKmTarget,
} from "$server/domain/reminder-lifecycle";
import {
  evaluateReminder,
  sortByUrgency,
  type ReminderInput,
  type UrgencyStatus,
} from "$server/domain/reminders";

import { appToday } from "$lib/utils/calendar-day";
import { buildDueNow, rankAttention } from "$server/domain/due-now";
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
  if (!motorcycle) throw new Error("Moto não encontrada.");
  return Number(motorcycle?.current_odometer_km ?? 0);
}

const baseActions = featureActions("reminders");

export const actions = localizedActions({
  createCalendar: async ({ locals, platform }) => {
    const ownerId = locals.user!.id;
    const token =
      crypto.randomUUID().replaceAll("-", "") +
      crypto.randomUUID().replaceAll("-", "");
    const hash = await shareTokenHash(token);
    try {
      const created = await locals.db.begin(async (tx) => {
        await lockObjectOwner(tx as unknown as Sql, ownerId);
        await tx`select id from profiles where id = ${ownerId} for update`;
        const [count] = await tx<Array<{ total: number }>>`
          select count(*)::int as total from calendar_feeds
          where owner_id = ${ownerId} and revoked_at is null and expires_at > now()
        `;
        if (Number(count.total) >= 3) return false;
        await tx`
          insert into calendar_feeds (owner_id, token_hash, token_prefix, locale, expires_at)
          values (${ownerId}, ${hash}, ${token.slice(0, 12)}, ${locals.locale}, now() + interval '1 year')
        `;
        return true;
      });
      if (!created)
        return fail(400, {
          message: "Revogue um calendário antes de criar outro (limite de 3).",
        });
      return {
        ok: true,
        calendarUrl: `${siteUrl(platform)}/calendar/${token}.ics`,
      };
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
  },
  revokeCalendar: async ({ locals, request }) => {
    const form = await request.formData();
    try {
      await locals.db`update calendar_feeds set revoked_at = now()
        where id = ${String(form.get("id") ?? "")} and owner_id = ${locals.user!.id}`;
      return { ok: true };
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
  },
  record: baseActions.default,
  snoozeDays: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const ownerId = locals.user!.id;
    try {
      const target = snoozeDateTarget(
        appToday(),
        Number(form.get("days") ?? 7),
      );
      const updated = await locals.db`
        update reminders
        set snoozed_until_date = ${target}, snoozed_until_km = null,
          last_notified_at = null, last_email_notified_at = null,
          last_push_notified_at = null, updated_at = now()
        where id = ${id} and owner_id = ${ownerId} and is_active = true
        returning id
      `;
      if (!updated.length)
        return fail(404, { message: "Lembrete não encontrado." });
      return { ok: true };
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
  },
  snoozeKm: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const ownerId = locals.user!.id;
    try {
      await locals.db.begin(async (transaction) => {
        const db = transaction as unknown as Sql;
        await lockObjectOwner(db, ownerId);
        await db`select id from profiles where id = ${ownerId} for update`;
        const [reminder] = await db<Array<{ motorcycle_id: string | null }>>`
          select motorcycle_id from reminders
          where id = ${id} and owner_id = ${ownerId} and is_active = true for update
        `;
        if (!reminder?.motorcycle_id)
          throw new Error("Vincule uma moto para adiar por quilômetros.");
        const current = await currentOdometerFor(
          db,
          ownerId,
          reminder.motorcycle_id,
        );
        const target = snoozeKmTarget(current, Number(form.get("km") ?? 500));
        await db`
          update reminders
          set snoozed_until_km = ${target}, snoozed_until_date = null,
            last_notified_at = null, last_email_notified_at = null,
            last_push_notified_at = null, updated_at = now()
          where id = ${id} and owner_id = ${ownerId}
        `;
      });
      return { ok: true };
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
  },
  complete: async ({ request, locals }) => {
    const form = await request.formData();
    const rawVersion = form.get("completion_version");
    try {
      return await completeReminder(
        locals.db,
        locals.user!.id,
        String(form.get("id") ?? ""),
        rawVersion === null || rawVersion === ""
          ? Number.NaN
          : Number(rawVersion),
      );
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
  },
});

type OdometerRow = { id: string; current_odometer_km: number | null };

export async function load({ locals }) {
  const ownerId = locals.user!.id;
  const [feature, calendars, odometers, planRows] = await Promise.all([
    loadFeature(locals.db, "reminders", locals.user!),
    locals.db<Array<{ id: string; token_prefix: string; expires_at: string }>>`
      select id, token_prefix, expires_at::text from calendar_feeds
      where owner_id = ${ownerId} and revoked_at is null and expires_at > now()
      order by created_at desc
    `,
    locals.db<OdometerRow[]>`
      select id, current_odometer_km from motorcycles
      where owner_id = ${ownerId} and deleted_at is null
    `.catch(() => [] as OdometerRow[]),
    // Same plan read as the bike home, so "Próximos" lists maintenance and
    // reminders together under one name.
    locals.db<Record<string, unknown>[]>`
      select p.id, p.motorcycle_id, p.maintenance_type, p.interval_km, p.interval_days,
        p.last_done_km, p.last_done_date, p.initial_history_status, p.estimated_cost_cents,
        p.schedule_milestones, p.recurrence_km, p.recurrence_months, p.last_completed_milestone,
        p.calendar_anchor_mode, m.in_service_date, m.name as motorcycle_name
      from maintenance_plan_items p
      join motorcycles m on m.id = p.motorcycle_id and m.owner_id = p.owner_id
      where p.owner_id = ${ownerId} and p.is_active = true and m.is_active = true
    `.catch(() => [] as Record<string, unknown>[]),
  ]);
  const odometerFor = new Map(
    odometers.map((row) => [row.id, Number(row.current_odometer_km ?? 0)]),
  );
  const today = appToday();
  // Each row carries its evaluated status so the list can lead with what is
  // overdue instead of the database order.
  const rows = sortByUrgency(
    feature.rows.map((row) => ({
      ...row,
      ...urgencyFor(row, odometerFor, today),
    })),
    (row) => row.urgency,
  );
  const maintenanceDue = rankAttention({
    dueNow: buildDueNow({
      rows: planRows,
      odometerByMotorcycle: odometerFor,
      limit: Number.POSITIVE_INFINITY,
      today,
    }),
    reminders: [],
  });
  return { ...feature, rows, calendars, maintenanceDue };
}

function urgencyFor(
  row: Record<string, unknown>,
  odometerFor: Map<string, number>,
  today: string,
): { urgency: UrgencyStatus; snoozed: boolean } {
  if (row.is_active === false) return { urgency: "inactive", snoozed: false };
  const evaluation = evaluateReminder(row as unknown as ReminderInput, {
    currentOdometerKm:
      odometerFor.get(String(row.motorcycle_id ?? "")) ?? Number.NaN,
    today,
  });
  return { urgency: evaluation.status, snoozed: evaluation.snoozed === true };
}
