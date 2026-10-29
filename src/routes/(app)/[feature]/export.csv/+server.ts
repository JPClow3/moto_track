import { error } from "@sveltejs/kit";
import { getFeature } from "$server/domain/features";
import { exportMessages } from "$lib/i18n/exports";
import { isoDateValue, isoTimestampValue } from "$server/domain/date-value";

// A spreadsheet runs a cell that starts with one of these as a formula. Text
// can come from shared-garage contributors, so it is not only the owner's own.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvValue(value: unknown, dateOnly: boolean) {
  if (value == null) return "";
  // postgres.js returns date/timestamptz columns as Date; String() of one is
  // "Wed Oct 28 2026 00:00:00 GMT+0000 (…)", which no importer reads back.
  if (value instanceof Date)
    return dateOnly ? isoDateValue(value) : (isoTimestampValue(value) ?? "");
  if (typeof value === "string" && FORMULA_PREFIX.test(value))
    return `'${value}`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function csvEscape(value: unknown, dateOnly = false) {
  return `"${csvValue(value, dateOnly).replaceAll('"', '""')}"`;
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
  const dateColumns = new Set(
    (feature.fields ?? [])
      .filter((field) => field.kind === "date")
      .map((field) => field.key),
  );
  // Keep schema keys and recorded values stable for spreadsheet/import round trips.
  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns
        .map((column) => csvEscape(row[column], dateColumns.has(column)))
        .join(","),
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
