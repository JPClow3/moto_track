import { json, error, isHttpError } from "@sveltejs/kit";
import type { PublicTableName } from "$lib/types/database";
import { getFeature } from "$server/domain/features";
import { normalizeApiFeaturePayload } from "$server/domain/api-write";
import { requireApiUser } from "$server/domain/api-auth";
import { assertCanCreateReminder } from "$server/domain/entitlement-guards";
import {
  syncRecordDeleteEffects,
  syncRecordEffects,
  assertFeatureReferences,
  recordTracksOdometer,
  syncChangedRecordOdometers,
} from "$server/domain/crud";
import { lockObjectOwner } from "$server/db/owner-lock";
import type { Sql } from "postgres";
import {
  enqueueObjectDeletions,
  deleteQueuedObjectsBestEffort,
} from "$server/r2/files";

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
  const config = Object.hasOwn(apiResources, resource)
    ? apiResources[resource]
    : undefined;
  if (!config) throw error(404, "Unknown API resource");
  return config;
}

function assertSupportedPhaseInput(
  featureSlug: string,
  body: Record<string, unknown>,
) {
  if (
    featureSlug === "maintenance" &&
    [body.maintenance_plan_item_id, body.completed_milestone].some(
      (value) => value != null && String(value).trim() !== "",
    )
  ) {
    throw error(
      400,
      "Use maintenance history to identify a completed service milestone.",
    );
  }
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
    const blocked = await assertCanCreateReminder(
      event.locals.db,
      user.id,
      event.platform,
    );
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
  assertSupportedPhaseInput(config.featureSlug, body);
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
    await event.locals.db.begin(async (transaction) => {
      const db = transaction as unknown as Sql;
      await lockObjectOwner(db, user.id);
      await assertFeatureReferences(db, user.id, feature, payload);
      [result] = await db<Array<Record<string, unknown>>>`
      insert into ${db(config.table)} ${db(payload)}
      returning *
    `;
      if (recordTracksOdometer(config.table))
        await syncChangedRecordOdometers(db, user.id, result ?? payload);
      const record = result ?? payload;
      await syncRecordEffects({
        db,
        ownerId: user.id,
        feature,
        recordId: String(record.id ?? payload.id),
        payload: record,
        syncOdometer: false,
      });
    });
  } catch (err) {
    throw error(400, messageFrom(err));
  }
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
  assertSupportedPhaseInput(config.featureSlug, body);
  const id = body.id;
  const normalized = normalizeApiFeaturePayload(feature, body, user.id);
  if (!normalized.ok) {
    throw error(400, "Invalid payload.");
  }
  let result: Record<string, unknown> | undefined;
  try {
    await event.locals.db.begin(async (transaction) => {
      const db = transaction as unknown as Sql;
      await lockObjectOwner(db, user.id);
      const [existing] = await db<Array<Record<string, unknown>>>`
        select * from ${db(config.table)} where id = ${id} and owner_id = ${user.id} for update
      `;
      if (!existing) throw error(404, "Record not found.");
      await assertFeatureReferences(db, user.id, feature, {
        ...existing,
        ...normalized.payload,
      });
      if (config.table === "reminders")
        normalized.payload.completion_version =
          Number(existing.completion_version ?? 0) + 1;
      [result] = await db<Array<Record<string, unknown>>>`
      update ${db(config.table)}
      set ${db(normalized.payload)}
      where id = ${id} and owner_id = ${user.id}
      returning *
    `;
      if (!result) throw error(404, "Record not found.");
      if (recordTracksOdometer(config.table))
        await syncChangedRecordOdometers(db, user.id, result, existing);
      await syncRecordEffects({
        db,
        ownerId: user.id,
        feature,
        recordId: id,
        payload: result,
        syncOdometer: false,
      });
    });
  } catch (err) {
    if (isHttpError(err)) throw err;
    throw error(400, messageFrom(err));
  }
  if (!result) throw error(404, "Record not found.");
  return json({ result });
}

export async function DELETE(event) {
  const { user } = await requireApiUser(event);
  const config = resourceOrThrow(event.params.resource);
  const feature = getFeature(config.featureSlug);
  const url = new URL(event.request.url);
  const id = url.searchParams.get("id");
  if (!id) throw error(400, "Query parameter id is required.");
  let objectKeys: string[] = [];
  try {
    objectKeys = await event.locals.db.begin(async (transaction) => {
      const db = transaction as unknown as Sql;
      await lockObjectOwner(db, user.id);
      const [existing] = await db<Array<Record<string, unknown>>>`
        select motorcycle_id from ${db(config.table)} where id = ${id} and owner_id = ${user.id} for update
      `;
      if (!existing) throw error(404, "Record not found.");
      const files = await db<Array<{ object_key: string }>>`
        select object_key from object_files where owner_id = ${user.id}
          and ((source_table = ${config.table} and source_id = ${id})
            or (${config.table} = 'maintenance_records' and source_table = 'maintenance_photos'
              and source_id in (select id from maintenance_photos where owner_id = ${user.id} and maintenance_record_id = ${id})))
      `;
      await enqueueObjectDeletions(
        db,
        user.id,
        files.map((file) => file.object_key),
      );
      await db`
        delete from object_files where owner_id = ${user.id}
          and ((source_table = ${config.table} and source_id = ${id})
            or (${config.table} = 'maintenance_records' and source_table = 'maintenance_photos'
              and source_id in (select id from maintenance_photos where owner_id = ${user.id} and maintenance_record_id = ${id})))
      `;
      await db`
      delete from ${db(config.table)}
      where id = ${id} and owner_id = ${user.id}
    `;
      await syncRecordDeleteEffects({
        db,
        ownerId: user.id,
        feature,
        recordId: id,
        existing,
        strictOdometer: true,
      });
      return files.map((file) => file.object_key);
    });
  } catch (err) {
    if (isHttpError(err)) throw err;
    throw error(400, messageFrom(err));
  }
  await deleteQueuedObjectsBestEffort({
    db: event.locals.db,
    objectKeys,
    ownerId: user.id,
    platform: event.platform,
  });
  return json({ ok: true });
}
