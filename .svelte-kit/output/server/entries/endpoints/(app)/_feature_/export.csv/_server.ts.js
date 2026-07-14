import { error } from "@sveltejs/kit";
import { g as getFeature } from "../../../../../chunks/features.js";
function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
async function GET({ params, locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const feature = getFeature(params.feature);
  const db = locals.supabase;
  const { data, error: dbError } = await db.from(feature.table).select("*").eq("owner_id", locals.user.id).limit(5e3);
  if (dbError) throw error(400, dbError.message);
  const rows = data ?? [];
  const columns = rows[0] ? Object.keys(rows[0]) : feature.listColumns;
  const csv = [
    columns.join(","),
    ...rows.map(
      (row) => columns.map((column) => csvEscape(row[column])).join(",")
    )
  ].join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${feature.slug}.csv"`
    }
  });
}
export {
  GET
};
