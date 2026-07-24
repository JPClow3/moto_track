import { json, error } from "@sveltejs/kit";
import type { PublicTableName } from "$lib/types/database";
import { getFeature } from "$server/domain/features";
import { normalizeApiFeaturePayload } from "$server/domain/api-write";
import { requireApiUser } from "$server/domain/api-auth";
import { assertCanCreateReminder } from "$server/domain/entitlement-guards";
import {
  syncRecordDeleteEffects,
  syncRecordEffects,
} from "$server/domain/crud";

// Values are literal table names (not user input), so `locals.db(table)` below
// is a safe dynamic identifier — the only untrusted part is the map lookup key.
// Every resource now has a matching `featureConfigs` entry, so reads and
// writes both go through the same feature-shaped payload validation.
const apiResources: Record<
  string,
  { table: PublicTableName; featureSlug: string }
> = {
  "fuel-records": { table: "fuel_records", featureSlug: "fuel" },
  "maintenance-records": {
    table: "maintenance_records",
    featureSlug: "maintenance",
  },
  "tire-records": { table: "tire_records", featureSlug: "tires" },
  reminders: { table: "reminders", featureSlug: "reminders" },
  documents: { table: "motorcycle_documents", featureSlug: "documents" },
  expenses: { table: "annual_fees", featureSlug: "expenses" },
};

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function resourceOrThrow(resource: string) {
  const config = apiResources[resource];
  if (!config) throw error(404, "Unknown API resource");
  return config;
}

export async function GET(event) {
  const { user } = await requireApiUser(event);
  const config = resourceOrThrow(event.params.resource);
  try {
    const results = await event.locals.db<Array<Record<string, unknown>>>`
      select * from ${event.locals.db(config.table)}
      where owner_id = ${user.id}
      limit 500
    `;
    return json({ results });
  } catch (err) {
    throw error(400, messageFrom(err));
  }
}

export async function POST(event) {
  const { user } = await requireApiUser(event);
  const config = resourceOrThrow(event.params.resource);
  if (config.featureSlug === "reminders") {
    const blocked = await assertCanCreateReminder(event.locals.db, user.id);
    if (blocked) throw error(403, blocked);
  }
  const feature = getFeature(config.featureSlug);
  const body = (await event.request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object") {
    throw error(400, "JSON body required.");
  }
  const normalized = normalizeApiFeaturePayload(feature, body, user.id);
  if (!normalized.ok) {
    throw error(400, "Invalid payload.");
  }
  const payload = {
    ...normalized.payload,
    id: crypto.randomUUID(),
  };
  let result: Record<string, unknown> | undefined;
  try {
    [result] = await event.locals.db<Array<Record<string, unknown>>>`
      insert into ${event.locals.db(config.table)} ${event.locals.db(payload)}
      returning *
    `;
  } catch (err) {
    throw error(400, messageFrom(err));
  }
  const record = result ?? payload;
  await syncRecordEffects({
    db: event.locals.db,
    ownerId: user.id,
    feature,
    recordId: String(record.id ?? payload.id),
    payload: record,
  });
  return json({ result }, { status: 201 });
}

export async function PATCH(event) {
  const { user } = await requireApiUser(event);
  const config = resourceOrThrow(event.params.resource);
  const feature = getFeature(config.featureSlug);
  const body = (await event.request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object" || typeof body.id !== "string") {
    throw error(400, "JSON body with id is required.");
  }
  const id = body.id;
  const normalized = normalizeApiFeaturePayload(feature, body, user.id);
  if (!normalized.ok) {
    throw error(400, "Invalid payload.");
  }
  let result: Record<string, unknown> | undefined;
  try {
    [result] = await event.locals.db<Array<Record<string, unknown>>>`
      update ${event.locals.db(config.table)}
      set ${event.locals.db(normalized.payload)}
      where id = ${id} and owner_id = ${user.id}
      returning *
    `;
  } catch (err) {
    throw error(400, messageFrom(err));
  }
  if (!result) throw error(404, "Record not found.");
  await syncRecordEffects({
    db: event.locals.db,
    ownerId: user.id,
    feature,
    recordId: id,
    payload: result,
  });
  return json({ result });
}

export async function DELETE(event) {
  const { user } = await requireApiUser(event);
  const config = resourceOrThrow(event.params.resource);
  const feature = getFeature(config.featureSlug);
  const url = new URL(event.request.url);
  const id = url.searchParams.get("id");
  if (!id) throw error(400, "Query parameter id is required.");
  let existing: Record<string, unknown> | undefined;
  try {
    [existing] = await event.locals.db<Array<Record<string, unknown>>>`
      select motorcycle_id from ${event.locals.db(config.table)}
      where id = ${id} and owner_id = ${user.id}
    `;
  } catch (err) {
    throw error(400, messageFrom(err));
  }
  if (!existing) throw error(404, "Record not found.");
  try {
    await event.locals.db`
      delete from ${event.locals.db(config.table)}
      where id = ${id} and owner_id = ${user.id}
    `;
  } catch (err) {
    throw error(400, messageFrom(err));
  }
  await syncRecordDeleteEffects({
    db: event.locals.db,
    ownerId: user.id,
    feature,
    recordId: id,
    existing,
  });
  return json({ ok: true });
}
