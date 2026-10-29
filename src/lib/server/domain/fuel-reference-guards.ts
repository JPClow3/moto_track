import type { Sql } from "postgres";
import { assertOwnedMotorcycleReference } from "./crud";

export async function assertOwnedFuelReferences(
  db: Sql,
  ownerId: string,
  payload: {
    motorcycle_id?: unknown;
    station_id?: unknown;
    fuel_grade_id?: unknown;
  },
) {
  await assertOwnedMotorcycleReference(db, ownerId, payload.motorcycle_id);
  for (const [table, key] of [
    ["fuel_stations", "station_id"],
    ["fuel_grades", "fuel_grade_id"],
  ] as const) {
    const value = payload[key];
    if (value === null || value === undefined || value === "") continue;
    if (typeof value !== "string" || !value.trim())
      throw new Error("Referência de combustível inválida.");
    const [owned] = await db<Array<{ id: string }>>`
      select id from ${db(table)} where id = ${value} and owner_id = ${ownerId} for share
    `;
    if (!owned) throw new Error("Referência de combustível inválida.");
  }
}
