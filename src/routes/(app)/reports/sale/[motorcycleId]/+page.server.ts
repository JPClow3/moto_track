import { error } from "@sveltejs/kit";

type Row = Record<string, unknown>;

export async function load({ locals, params }) {
  const ownerId = locals.user!.id;
  // Matches the old Supabase behaviour, where a failed query resolved to
  // `data: null`/`[]` instead of rejecting: an errored motorcycle lookup still
  // reads as "not found" and an errored cost query still sums to 0.
  const [[motorcycle], fuel, maintenance, tires, fees] = await Promise.all([
    locals.db<Row[]>`
      select * from motorcycles
      where id = ${params.motorcycleId} and owner_id = ${ownerId}
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select total_price_cents from fuel_records
      where motorcycle_id = ${params.motorcycleId} and owner_id = ${ownerId}
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select cost_cents from maintenance_records
      where motorcycle_id = ${params.motorcycleId} and owner_id = ${ownerId}
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select cost_cents from tire_records
      where motorcycle_id = ${params.motorcycleId} and owner_id = ${ownerId}
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select amount_cents from annual_fees
      where motorcycle_id = ${params.motorcycleId} and owner_id = ${ownerId}
    `.catch(() => [] as Row[]),
  ]);
  if (!motorcycle) throw error(404, "Motorcycle not found");
  const sum = (rows: Row[], key: string) =>
    rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  return {
    motorcycle,
    totals: {
      fuel: sum(fuel, "total_price_cents"),
      maintenance: sum(maintenance, "cost_cents"),
      tires: sum(tires, "cost_cents"),
      fees: sum(fees, "amount_cents"),
    },
  };
}
