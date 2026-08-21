import { fail } from "@sveltejs/kit";
import { deleteOwnedRow, featureActions } from "$server/domain/crud";
import { estimateTireLife } from "$server/domain/tire-life";

type Row = Record<string, unknown>;

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const base = featureActions("tires");
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export const actions = {
  ...base,
  saveProduct: async ({ request, locals }) => {
    const f = await request.formData();
    try {
      await locals.db`
        insert into tire_products ${locals.db({
          owner_id: locals.user!.id,
          manufacturer: v(f, "manufacturer"),
          model_name: v(f, "model_name"),
          tire_type: v(f, "tire_type") || "street",
          price_cents: Math.round(Number(f.get("price") ?? 0) * 100),
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
  savePressure: async ({ request, locals }) => {
    const f = await request.formData();
    try {
      await locals.db`
        insert into tire_pressure_records ${locals.db({
          owner_id: locals.user!.id,
          motorcycle_id: v(f, "motorcycle_id"),
          date: v(f, "date"),
          psi_front: Number(f.get("psi_front")),
          psi_rear: Number(f.get("psi_rear")),
          notes: v(f, "notes"),
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
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
};

export async function load({ locals }) {
  const ownerId = locals.user!.id;
  const [motorcycleRows, recordResult, products, pressures] = await Promise.all(
    [
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
      left join motorcycles m on m.id = t.motorcycle_id
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
      left join motorcycles m on m.id = p.motorcycle_id
      where p.owner_id = ${ownerId}
      order by p.date desc
    `.catch(() => [] as Row[]),
    ],
  );

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
      currentKm !== null && installedKm !== null && wearPercent !== null
        ? estimateTireLife({
            installedKm,
            currentKm,
            wearPercent,
          })
        : null;
    return { ...row, current_km: currentKm, life_estimate: estimate };
  });

  return {
    errorMessage: recordResult.error ?? "",
    rows,
    activeTires: rows.filter((row) => row.is_active === true),
    motorcycles: motorcycleRows,
    products,
    pressures: pressures.map(
      (pressure): Row & { motorcycles: { name: unknown } | null } => ({
        ...pressure,
        motorcycles: pressure.motorcycle_name
          ? { name: pressure.motorcycle_name }
          : null,
      }),
    ),
  };
}
