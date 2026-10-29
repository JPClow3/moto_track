/**
 * postgres.js returns `date` columns as midnight-UTC Date objects. Rendered
 * as a Date they land on the previous day west of UTC, and `String(date)` is
 * not a value an `<input type="date">` accepts.
 */
export function dateOnlyValue(value: unknown): string | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))
    return value.slice(0, 10);
  return null;
}

/** Money is stored in cents (or millicents) but typed in whole currency. */
export function moneyStep(key: string) {
  return key.endsWith("_millicents") ? "0.001" : "0.01";
}

/**
 * Prefill for the edit form, in the same units the create form posts. Raw
 * cents here were multiplied by 100 again on save.
 */
export function editFieldValue(
  kind: string,
  key: string,
  value: unknown,
): string {
  if (value === null || value === undefined || value === "") return "";
  if (kind === "money") {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "";
    return String(key.endsWith("_millicents") ? amount / 100000 : amount / 100);
  }
  if (kind === "date") return dateOnlyValue(value) ?? "";
  return String(value);
}
