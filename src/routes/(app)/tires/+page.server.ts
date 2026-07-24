import { fail } from "@sveltejs/kit";
import {
  deleteOwnedRow,
  featureActions,
  loadFeature,
} from "$server/domain/crud";

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
  const baseData = await loadFeature(locals.db, "tires", locals.user!);
  const [products, pressures] = await Promise.all([
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
  ]);
  return {
    ...baseData,
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
