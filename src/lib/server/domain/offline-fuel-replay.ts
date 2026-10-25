import type { Sql } from "postgres";

const uuidFields = new Set([
  "id",
  "owner_id",
  "motorcycle_id",
  "station_id",
  "fuel_grade_id",
]);
const numericFields = new Set([
  "odometer_km",
  "liters",
  "total_price_cents",
  "price_per_liter_millicents",
]);

function canonicalFuelValue(
  key: string,
  value: unknown,
): string | number | boolean | null {
  if (value === null) return null;
  if (key === "date" && value instanceof Date)
    return value.toISOString().slice(0, 10);
  if (uuidFields.has(key) && typeof value === "string")
    return value.toLowerCase();
  if (numericFields.has(key) || typeof value === "number") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new OfflineFuelConflict();
    return key === "liters" ? Math.round(numeric * 1000) / 1000 : numeric;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  throw new OfflineFuelConflict();
}

/** Compare only canonical submitted fields; timestamps are server-owned. */
export function matchesFuelReplay(
  stored: Record<string, unknown>,
  submitted: Record<string, unknown>,
): boolean {
  return Object.entries(submitted).every(([key, expected]) => {
    const actual = stored[key];
    if (actual === undefined) return false;
    return (
      canonicalFuelValue(key, actual) === canonicalFuelValue(key, expected)
    );
  });
}

export function offlineFuelId(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value.toLowerCase()
    : null;
}

export class OfflineFuelConflict extends Error {}

/** Hash outside the transaction. Sorted, canonical primitives contain no secrets. */
export async function offlineFuelFingerprint(payload: Record<string, unknown>) {
  const canonical = Object.keys(payload)
    .sort()
    .map((key) => [key, canonicalFuelValue(key, payload[key])]);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Caller must hold the owner lock in the same transaction as the record insert. */
export async function acceptOfflineFuelSubmission(
  db: Sql,
  ownerId: string,
  id: string,
  fingerprint: string,
) {
  const inserted = await db<Array<{ id: string }>>`
    insert into offline_fuel_submissions (id, owner_id, payload_fingerprint)
    values (${id}, ${ownerId}, ${fingerprint}) on conflict (id) do nothing returning id
  `;
  if (inserted.length) return;
  const [receipt] = await db<
    Array<{ owner_id: string; payload_fingerprint: string | null }>
  >`
    select owner_id, payload_fingerprint from offline_fuel_submissions where id = ${id} for update
  `;
  if (
    !receipt ||
    receipt.owner_id !== ownerId ||
    receipt.payload_fingerprint !== fingerprint
  )
    throw new OfflineFuelConflict();
}

/** A matching receipt acknowledges a past commit even after its record was deleted. */
export async function resolveOfflineFuelSubmission(
  db: Sql,
  ownerId: string,
  payload: Record<string, unknown> & { id: string },
  fingerprint: string,
): Promise<"new" | "accepted"> {
  const [receipt] = await db<
    Array<{ owner_id: string; payload_fingerprint: string | null }>
  >`
    select owner_id, payload_fingerprint from offline_fuel_submissions where id = ${payload.id} for update
  `;
  if (receipt) {
    if (
      receipt.owner_id === ownerId &&
      receipt.payload_fingerprint === fingerprint
    )
      return "accepted";
    throw new OfflineFuelConflict();
  }
  // Existing submissions from before this protocol can be adopted only while
  // their original record proves ownership and the complete canonical payload.
  const [record] = await db<Array<Record<string, unknown>>>`
    select *, date::text as date from fuel_records where id = ${payload.id} and owner_id = ${ownerId} for update
  `;
  if (!record) return "new";
  if (!matchesFuelReplay(record, payload)) throw new OfflineFuelConflict();
  await acceptOfflineFuelSubmission(db, ownerId, payload.id, fingerprint);
  return "accepted";
}
