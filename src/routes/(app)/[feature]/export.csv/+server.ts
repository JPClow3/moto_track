import { error } from "@sveltejs/kit";
import { getFeature } from "$server/domain/features";
import { exportMessages } from "$lib/i18n/exports";

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET({ params, locals }) {
  const copy = exportMessages(locals.locale);
  if (!locals.user) throw error(401, copy.authenticationRequired);
  let feature: ReturnType<typeof getFeature>;
  try {
    feature = getFeature(params.feature);
    if (typeof feature.table !== "string" || typeof feature.slug !== "string") {
      throw new Error("Unknown export");
    }
  } catch {
    throw error(404, copy.unknownFeature);
  }
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
  // Keep schema keys and recorded values stable for spreadsheet/import round trips.
  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => csvEscape(row[column])).join(","),
    ),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-language": locals.locale,
      "content-disposition": `attachment; filename="${feature.slug}.csv"`,
    },
  });
}
