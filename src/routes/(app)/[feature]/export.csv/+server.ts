import { error } from "@sveltejs/kit";
import { getFeature } from "$server/domain/features";

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET({ params, locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const feature = getFeature(params.feature);
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await locals.db<Array<Record<string, unknown>>>`
      select * from ${locals.db(feature.table)}
      where owner_id = ${locals.user.id}
      limit 5000
    `;
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : String(err));
  }
  const columns = rows[0] ? Object.keys(rows[0]) : feature.listColumns;
  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => csvEscape(row[column])).join(","),
    ),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${feature.slug}.csv"`,
    },
  });
}
