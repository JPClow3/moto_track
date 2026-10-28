import { localizedActions } from "$server/domain/localized-actions";
import { createTranslator } from "$lib/i18n";
import { error, fail } from "@sveltejs/kit";
import {
  canWriteGarageRecord,
  requireGarageMembership,
} from "$server/domain/garage-access";
import { getFeature } from "$server/domain/features";
import {
  normalizeFeaturePayload,
  syncRecordEffects,
} from "$server/domain/crud";
import type { Sql } from "postgres";
import { validDate } from "$server/domain/maintenance-forecast";
import { assertOwnedFuelReferences } from "$server/domain/fuel-reference-guards";
import { lockAccountActor, lockObjectOwner } from "$server/db/owner-lock";

import { latestCalendarDay } from "$lib/utils/calendar-day";
export async function load({ locals, params }) {
  const membership = await requireGarageMembership(
    locals.db,
    locals.user!.id,
    String(params.accessId ?? ""),
    false,
    locals.locale,
  );
  const owner = membership.owner_id;
  const [motorcycles, maintenance, fuel] = await Promise.all([
    locals.db<
      Array<{
        id: string;
        name: string;
        brand: string;
        model: string;
        year: number;
        current_odometer_km: number;
      }>
    >`
      select id, name, brand, model, year, current_odometer_km from motorcycles
      where owner_id = ${owner} and is_active = true and deleted_at is null order by name
    `,
    locals.db<
      Array<{
        id: string;
        motorcycle_id: string;
        date: string;
        maintenance_type: string;
        description: string;
        cost_cents: number;
        odometer_km: number;
      }>
    >`
      select r.id, r.motorcycle_id, r.date::text, r.maintenance_type, r.description, r.cost_cents, r.odometer_km
      from maintenance_records r join motorcycles m on m.id = r.motorcycle_id and m.owner_id = ${owner}
      where r.owner_id = ${owner} and m.is_active = true and m.deleted_at is null order by r.date desc limit 100
    `,
    membership.role === "workshop"
      ? []
      : locals.db<
          Array<{
            id: string;
            motorcycle_id: string;
            date: string;
            liters: number;
            total_price_cents: number;
            odometer_km: number;
          }>
        >`
      select r.id, r.motorcycle_id, r.date::text, r.liters, r.total_price_cents, r.odometer_km
      from fuel_records r join motorcycles m on m.id = r.motorcycle_id and m.owner_id = ${owner}
      where r.owner_id = ${owner} and m.is_active = true and m.deleted_at is null order by r.date desc limit 100
    `,
  ]);
  return { role: membership.role, motorcycles, maintenance, fuel };
}

export const actions = localizedActions({
  record: async ({ locals, request, params }) => {
    const form = await request.formData();
    if (
      String(form.get("maintenance_plan_item_id") ?? "").trim() ||
      String(form.get("completed_milestone") ?? "").trim()
    )
      return fail(403, {
        message: createTranslator(locals.locale)("sharing.ownerConfirmStages"),
      });
    const slug = String(form.get("feature") ?? "");
    if (!["fuel", "maintenance"].includes(slug))
      return fail(400, {
        message: createTranslator(locals.locale)("sharing.invalidRecord"),
      });
    const feature = getFeature(slug);
    try {
      await locals.db.begin(async (transaction) => {
        const db = transaction as unknown as Sql;
        // Account deletion must wait before it can cascade into the membership
        // locked below; otherwise the audit actor's FK can form a lock cycle.
        await lockAccountActor(db, locals.user!.id);
        const access = await requireGarageMembership(
          db,
          locals.user!.id,
          String(params.accessId ?? ""),
          false,
          locals.locale,
        );
        await lockObjectOwner(db, access.owner_id);
        // Lock against revocation for the entire write, including derived data.
        const membership = await requireGarageMembership(
          db,
          locals.user!.id,
          String(params.accessId ?? ""),
          true,
          locals.locale,
        );
        if (!canWriteGarageRecord(membership.role, slug))
          throw error(
            403,
            createTranslator(locals.locale)("sharing.permissionDenied"),
          );
        const normalized = normalizeFeaturePayload(feature, form, {
          id: membership.owner_id,
        });
        if (!normalized.ok)
          throw error(
            400,
            createTranslator(locals.locale)("sharing.checkFields"),
          );
        const payload = normalized.payload;
        const date = validDate(payload.date);
        const odometer = Number(payload.odometer_km);
        if (
          !date ||
          date > latestCalendarDay() ||
          !Number.isInteger(odometer) ||
          odometer < 0 ||
          odometer > 2147483647
        ) {
          throw error(
            400,
            createTranslator(locals.locale)("sharing.validDateOdometer"),
          );
        }
        const amount = Number(
          payload[slug === "fuel" ? "total_price_cents" : "cost_cents"] ?? 0,
        );
        if (
          !Number.isInteger(amount) ||
          amount < 0 ||
          amount > 2147483647 ||
          (slug === "fuel" &&
            (!Number.isFinite(Number(payload.liters)) ||
              Number(payload.liters) <= 0 ||
              Number(payload.liters) > 1000)) ||
          String(payload.maintenance_type ?? "").length > 120 ||
          String(payload.description ?? "").length > 2000 ||
          String(payload.workshop ?? "").length > 160 ||
          String(payload.station_name ?? "").length > 160
        ) {
          throw error(
            400,
            createTranslator(locals.locale)("sharing.checkValues"),
          );
        }
        const [motorcycle] = await db<Array<{ id: string }>>`
          select id from motorcycles where id = ${String(payload.motorcycle_id ?? "")}
            and owner_id = ${membership.owner_id} and is_active = true and deleted_at is null for update
        `;
        if (!motorcycle)
          throw error(
            404,
            createTranslator(locals.locale)("sharing.motorcycleNotFound"),
          );
        // The fuel feature form does not carry station/grade IDs today; keep the
        // owner fuel route's guard so any future reference stays owner-scoped.
        if (slug === "fuel")
          await assertOwnedFuelReferences(db, membership.owner_id, payload);
        const id = crypto.randomUUID();
        payload.id = id;
        await db`insert into ${db(feature.table)} ${db(payload)}`;
        await syncRecordEffects({
          db,
          ownerId: membership.owner_id,
          feature,
          recordId: id,
          payload,
        });
        await db`insert into garage_activity (owner_id, actor_id, membership_id, record_table, record_id)
          values (${membership.owner_id}, ${locals.user!.id}, ${membership.id}, ${feature.table}, ${id})`;
      });
      return { ok: true };
    } catch (cause) {
      const status =
        cause && typeof cause === "object" && "status" in cause
          ? Number(cause.status)
          : 400;
      const message =
        cause && typeof cause === "object" && "body" in cause
          ? String(
              (cause.body as { message?: string }).message ??
                createTranslator(locals.locale)("sharing.saveFailed"),
            )
          : createTranslator(locals.locale)("sharing.saveFailed");
      return fail(
        [400, 403, 404].includes(status) ? (status as 400 | 403 | 404) : 400,
        { message },
      );
    }
  },
});
