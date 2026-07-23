import { json, error } from "@sveltejs/kit";
import type { PublicTableName } from "$lib/types/database";

// Values are literal table names (not user input), so `locals.db(table)` below
// is a safe dynamic identifier — the only untrusted part is the map lookup key.
const apiResources: Record<string, PublicTableName> = {
  "fuel-records": "fuel_records",
  "maintenance-records": "maintenance_records",
  "tire-records": "tire_records",
  reminders: "reminders",
  documents: "motorcycle_documents",
  expenses: "annual_fees",
};

export async function GET({ params, locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const table = apiResources[params.resource];
  if (!table) throw error(404, "Unknown API resource");
  try {
    const results = await locals.db<Array<Record<string, unknown>>>`
      select * from ${locals.db(table)}
      where owner_id = ${locals.user.id}
      limit 500
    `;
    return json({ results });
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : String(err));
  }
}
