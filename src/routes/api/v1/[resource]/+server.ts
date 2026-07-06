import { json, error } from "@sveltejs/kit";

const apiResources: Record<string, string> = {
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
  const { data, error: dbError } = await locals.supabase
    .from(table)
    .select("*")
    .eq("owner_id", locals.user.id)
    .limit(500);
  if (dbError) throw error(400, dbError.message);
  return json({ results: data ?? [] });
}
