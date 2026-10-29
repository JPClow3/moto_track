import { localizedActions } from "$server/domain/localized-actions";
import { createTranslator } from "$lib/i18n";
import { fail } from "@sveltejs/kit";
import {
  deleteOwnedRow,
  featureActions,
  parseFormNumber,
  parseMoneyCents,
  assertOwnedMotorcycleReference,
} from "$server/domain/crud";
import { estimateTireLife } from "$server/domain/tire-life";
import {
  estimateDailyDistance,
  forecastDateAtKm,
} from "$server/domain/maintenance-forecast";
import { loadOdometerHistory } from "$server/domain/odometer-history";
import { isoDateValue, isoTimestampValue } from "$server/domain/date-value";
import { lockObjectOwner } from "$server/r2/files";

import { appToday } from "$lib/utils/calendar-day";
type Row = Record<string, unknown>;

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const base = featureActions("tires");
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

const savePressureAction = async ({
  request,
  locals,
}: {
  request: Request;
  locals: App.Locals;
}) => {
  const f = await request.formData();
  const ownerId = locals.user!.id;
  const motorcycleId = v(f, "motorcycle_id");
  try {
    await locals.db.begin(async (transaction) => {
      const db = transaction as unknown as typeof locals.db;
      await lockObjectOwner(db, ownerId);
      await assertOwnedMotorcycleReference(db, ownerId, motorcycleId, {
        required: true,
      });
      await db`
      insert into tire_pressure_records ${db({
        owner_id: ownerId,
        motorcycle_id: motorcycleId,
        date: v(f, "date"),
        psi_front: parseFormNumber(f.get("psi_front")),
        psi_rear: parseFormNumber(f.get("psi_rear")),
        notes: v(f, "notes"),
      })}
    `;
    });
  } catch (err) {
    return fail(400, { message: messageFrom(err) });
  }
  return { ok: true };
};

export const actions = localizedActions({
  recordWearObservation: async ({ request, locals }) => {
    const form = await request.formData();
    const id = v(form, "id");
    const rawWear = v(form, "wear_percent");
    const wear = Number(rawWear);
    const t = createTranslator(locals.locale);
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        id,
      ) ||
      !rawWear ||
      !Number.isInteger(wear) ||
      wear < 0 ||
      wear > 100
    )
      return fail(400, { message: t("tires.invalidWearObservation") });
    const ownerId = locals.user!.id;
    try {
      const recorded = await locals.db.begin(async (transaction) => {
        const db = transaction as unknown as typeof locals.db;
        await lockObjectOwner(db, ownerId);
        const [tire] = await db<Array<{ id: string }>>`
          select r.id from tire_records r
          join motorcycles m on m.id = r.motorcycle_id and m.owner_id = ${ownerId}
          where r.id = ${id} and r.owner_id = ${ownerId} and r.is_active = true
            and m.is_active = true and m.deleted_at is null
          for update of r, m
        `;
        if (!tire) return false;
        await db`
          update tire_records set wear_percent = ${wear},
            wear_observed_at = clock_timestamp(), updated_at = now()
          where id = ${id} and owner_id = ${ownerId}
        `;
        return true;
      });
      return recorded
        ? { ok: true, wearObservationSaved: true }
        : fail(404, { message: t("tires.tireNotFound") });
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
  },
  installTire: base.default,
  deleteTire: base.default,
  logPressure: savePressureAction,
  savePressure: savePressureAction,
  saveProduct: async ({ request, locals }) => {
    const f = await request.formData();
    try {
      await locals.db`
        insert into tire_products ${locals.db({
          owner_id: locals.user!.id,
          manufacturer: v(f, "manufacturer"),
          model_name: v(f, "model_name"),
          tire_type: v(f, "tire_type") || "street",
          price_cents: parseMoneyCents(f.get("price")),
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  deleteProduct: async ({ request, locals }) => {
    const f = await request.formData();
    const error = await deleteOwnedRow(
      locals.db,
      "tire_products",
      v(f, "id"),
      locals.user!.id,
    );
    return error ? fail(400, { message: error }) : { ok: true };
  },
  deletePressure: async ({ request, locals }) => {
    const f = await request.formData();
    const error = await deleteOwnedRow(
      locals.db,
      "tire_pressure_records",
      v(f, "id"),
      locals.user!.id,
    );
    return error ? fail(400, { message: error }) : { ok: true };
  },
});

export async function load({ locals, parent }) {
  const ownerId = locals.user!.id;
  // The shell's bike switcher resolves the active bike; default the page view
  // and its quick-log sheets to it rather than to the first bike by name.
  const requestedMotorcycleId =
    typeof parent === "function"
      ? ((await parent()).activeMotorcycleId ?? null)
      : null;
  const [motorcycleRows, recordResult, products, pressures, odometerHistory] =
    await Promise.all([
      locals.db<
        Array<{
          id: string;
          name: string;
          brand: string;
          model: string;
          current_odometer_km: number | null;
        }>
      >`
      select id, name, brand, model, current_odometer_km from motorcycles
      where owner_id = ${ownerId} and is_active = true and deleted_at is null
      order by name
    `.catch(() => []),
      locals.db<Row[]>`
      select t.*, m.name as motorcycle_name
      from tire_records t
      left join motorcycles m on m.id = t.motorcycle_id and m.owner_id = t.owner_id
      where t.owner_id = ${ownerId}
      order by t.installed_at desc
      limit 100
    `.then(
        (rows) => ({ rows, error: null as string | null }),
        (err: unknown) => ({ rows: [] as Row[], error: messageFrom(err) }),
      ),
      locals.db<Row[]>`
      select * from tire_products
      where owner_id = ${ownerId}
      order by manufacturer
    `.catch(() => [] as Row[]),
      locals.db<Row[]>`
      select p.*, m.name as motorcycle_name
      from tire_pressure_records p
      left join motorcycles m on m.id = p.motorcycle_id and m.owner_id = p.owner_id
      where p.owner_id = ${ownerId}
      order by p.date desc
    `.catch(() => [] as Row[]),
      loadOdometerHistory(locals.db, ownerId).catch(() => new Map()),
    ]);

  // The wear estimate needs the bike's live odometer, so join it in memory
  // rather than relying on the stored estimated_change_km, which goes stale
  // every time the rider logs kilometres elsewhere in the app.
  const odometerByMotorcycle = new Map(
    motorcycleRows.map((row) => [
      String(row.id),
      Number(row.current_odometer_km ?? 0),
    ]),
  );

  const rows = recordResult.rows.map<
    Row & {
      current_km: number | null;
      life_estimate: { projectedChangeKm: number; remainingKm: number } | null;
      estimated_change_date: string | null;
    }
  >((row) => {
    const motorcycleId = String(row.motorcycle_id ?? "");
    const currentKm = odometerByMotorcycle.get(motorcycleId) ?? null;
    const installedKm =
      row.installed_odometer_km == null
        ? null
        : Number(row.installed_odometer_km);
    const wearPercent =
      row.wear_percent == null ? null : Number(row.wear_percent);
    const estimate =
      currentKm !== null &&
      installedKm !== null &&
      wearPercent !== null &&
      row.wear_odometer_km !== null &&
      row.wear_odometer_km !== undefined
        ? estimateTireLife({
            installedKm,
            currentKm,
            wearPercent,
            observedKm: Number(row.wear_odometer_km),
          })
        : null;
    const today = appToday();
    const pace = estimateDailyDistance(
      odometerHistory.get(motorcycleId) ?? [],
      today,
    );
    return {
      ...row,
      installed_at: isoDateValue(row.installed_at),
      wear_observed_at: isoTimestampValue(row.wear_observed_at),
      current_km: currentKm,
      life_estimate: estimate,
      estimated_change_date:
        estimate && currentKm !== null
          ? forecastDateAtKm(estimate.projectedChangeKm, currentKm, pace, today)
          : null,
    };
  });

  return {
    errorMessage: recordResult.error ?? "",
    rows,
    activeTires: rows.filter((row) => row.is_active === true),
    motorcycles: motorcycleRows,
    activeMotorcycleId:
      motorcycleRows.find((row) => String(row.id) === requestedMotorcycleId)
        ?.id ??
      motorcycleRows[0]?.id ??
      null,
    products,
    pressures: pressures.map(
      (pressure): Row & { motorcycles: { name: unknown } | null } => ({
        ...pressure,
        date: isoDateValue(pressure.date),
        motorcycles: pressure.motorcycle_name
          ? { name: pressure.motorcycle_name }
          : null,
      }),
    ),
  };
}
