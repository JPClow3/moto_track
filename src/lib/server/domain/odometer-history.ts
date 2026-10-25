import type { Sql } from "postgres";
import type { OdometerSample } from "./maintenance-forecast";

export async function loadOdometerHistory(db: Sql, ownerId: string) {
  const rows = await db<Array<OdometerSample & { motorcycle_id: string }>>`
    select motorcycle_id, date::text, odometer_km from fuel_records
    where owner_id = ${ownerId} and date >= current_date - 90
    union all
    select motorcycle_id, date::text, odometer_km from maintenance_records
    where owner_id = ${ownerId} and date >= current_date - 90
  `;
  const result = new Map<string, OdometerSample[]>();
  for (const row of rows) {
    const samples = result.get(row.motorcycle_id) ?? [];
    samples.push({ date: row.date, odometer_km: Number(row.odometer_km) });
    result.set(row.motorcycle_id, samples);
  }
  return result;
}
