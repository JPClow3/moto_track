import type { Sql } from "postgres";
import { calculateOwnershipCost } from "./ownership-cost";
import { validDate } from "./maintenance-forecast";

export type OwnershipMotorcycle = {
  id: string;
  name: string;
  current_odometer_km: number;
  purchase_odometer_km: number | null;
  purchase_price_cents: number | null;
  purchase_currency?: string;
  purchase_date: string | null;
  fuel_cents: number;
  maintenance_cents: number;
  tire_cents: number;
  fee_cents: number;
};

export function ownershipSummary(row: OwnershipMotorcycle) {
  const ready =
    (row.purchase_currency ?? "BRL") === "BRL" &&
    validDate(row.purchase_date) !== null &&
    row.purchase_odometer_km !== null &&
    Number.isFinite(Number(row.purchase_odometer_km)) &&
    Number(row.purchase_odometer_km) >= 0 &&
    row.purchase_price_cents !== null &&
    Number.isFinite(Number(row.purchase_price_cents));
  const distanceKm = ready
    ? Number(row.current_odometer_km) - Number(row.purchase_odometer_km)
    : null;
  const cost = calculateOwnershipCost({
    purchaseCents: Number(row.purchase_price_cents ?? 0),
    fuelCents: Number(row.fuel_cents),
    maintenanceCents: Number(row.maintenance_cents),
    tireCents: Number(row.tire_cents),
    feeCents: Number(row.fee_cents),
    currentKm: distanceKm ?? 0,
  });
  return { ...row, ready, distanceKm, ...cost };
}

export async function loadOwnershipCosts(db: Sql, ownerId: string) {
  const rows = await db<OwnershipMotorcycle[]>`
    select m.id, m.name, m.current_odometer_km, m.purchase_odometer_km,
      m.purchase_price_cents, m.purchase_currency, m.purchase_date::text,
      coalesce((select sum(f.total_price_cents) from fuel_records f
        where f.owner_id = ${ownerId} and f.motorcycle_id = m.id and f.currency = 'BRL' and f.date between m.purchase_date and current_date), 0) as fuel_cents,
      coalesce((select sum(r.cost_cents) from maintenance_records r
        where r.owner_id = ${ownerId} and r.motorcycle_id = m.id and r.currency = 'BRL' and r.date between m.purchase_date and current_date), 0) as maintenance_cents,
      coalesce((select sum(t.cost_cents) from tire_records t
        where t.owner_id = ${ownerId} and t.motorcycle_id = m.id and t.currency = 'BRL' and t.installed_at between m.purchase_date and current_date), 0) as tire_cents,
      coalesce((select sum(a.amount_cents) from annual_fees a
        where a.owner_id = ${ownerId} and a.motorcycle_id = m.id and a.currency = 'BRL' and a.due_date between m.purchase_date and current_date), 0) +
      coalesce((select sum(i.premium_cents) from insurance_policies i
        where i.owner_id = ${ownerId} and i.motorcycle_id = m.id and i.currency = 'BRL' and i.coverage_start between m.purchase_date and current_date), 0) as fee_cents
    from motorcycles m where m.owner_id = ${ownerId} and m.deleted_at is null
    order by m.name
  `;
  return rows.map(ownershipSummary);
}
