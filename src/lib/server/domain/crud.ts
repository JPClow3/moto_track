import { fail, type Actions } from "@sveltejs/kit";
import type { Sql } from "postgres";
import { getFeature, schemaForFeature, type FeatureConfig } from "./features";
import {
  deleteQueuedObjectsBestEffort,
  enqueueObjectDeletions,
  queueUploadedOrphansBestEffort,
  uploadObjectFile,
} from "$server/r2/files";
import { parseLocalizedNumber } from "$server/domain/fuel";
import { syncMotorcycleOdometer } from "$server/domain/odometer";
import { syncLinkedReminder } from "$server/domain/record-sync";
import {
  assertCanCreateReminder,
  assertCanCreateUpload,
  assertCanCreateWorkSession,
} from "$server/domain/entitlement-guards";

// Only `.id` from the session user is ever needed here. `locals.user` (see
// src/app.d.ts) satisfies this structurally, so callers can pass it directly.
type FeatureUser = { id: string };

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function motorcycleIdFrom(payload: Record<string, unknown>) {
  const value = payload.motorcycle_id;
  return typeof value === "string" && value ? value : null;
}

export function parseFormNumber(value: unknown, fallback = 0): number {
  if (typeof value === "string") {
    const parsed = parseLocalizedNumber(value);
    if (parsed !== null) return parsed;
  }
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

export function parseMoneyCents(value: unknown, fallback = 0): number {
  return Math.round(parseFormNumber(value, fallback) * 100);
}

export function parseMoneyMillicents(value: unknown, fallback = 0): number {
  return Math.round(parseFormNumber(value, fallback) * 100000);
}

export async function syncRecordEffects({
  db,
  ownerId,
  feature,
  recordId,
  payload,
}: {
  db: Sql;
  ownerId: string;
  feature: FeatureConfig;
  recordId: string;
  payload: Record<string, unknown>;
}) {
  const motorcycleId = motorcycleIdFrom(payload);
  if (motorcycleId) {
    await syncMotorcycleOdometer(db, ownerId, motorcycleId);
  }
  await syncLinkedReminder(db, ownerId, feature.table, recordId, payload);
}

export async function syncRecordDeleteEffects({
  db,
  ownerId,
  feature,
  recordId,
  existing,
}: {
  db: Sql;
  ownerId: string;
  feature: FeatureConfig;
  recordId: string;
  existing: Record<string, unknown>;
}) {
  await syncLinkedReminder(db, ownerId, feature.table, recordId, {});
  const motorcycleId = motorcycleIdFrom(existing);
  if (motorcycleId) {
    await syncMotorcycleOdometer(db, ownerId, motorcycleId);
  }
}

// Shared by every quick-action delete button (expenses/maintenance/tires
// side-tables) so each route doesn't hand-roll the same owner-scoped delete.
export async function deleteOwnedRow(
  db: Sql,
  table: string,
  id: string,
  ownerId: string,
): Promise<string | null> {
  try {
    await db`
      delete from ${db(table)}
      where id = ${id} and owner_id = ${ownerId}
    `;
    return null;
  } catch (err) {
    return messageFrom(err);
  }
}

export function normalizeFeaturePayload(
  feature: FeatureConfig,
  formData: FormData,
  user: FeatureUser,
) {
  const raw: Record<string, unknown> = {};
  for (const field of feature.fields) {
    if (field.kind === "file") continue;
    const formValue = formData.get(field.key);
    if (field.kind === "boolean") {
      raw[field.key] = formValue === "true";
    } else {
      raw[field.key] = formValue ?? "";
    }
  }

  const parsed = schemaForFeature(feature).safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }

  const payload: Record<string, unknown> = {};
  for (const field of feature.fields) {
    if (field.kind === "file") continue;
    const value = parsed.data[field.key];
    if (value === "" || value === undefined) continue;
    if (field.kind === "money") {
      if (field.key.endsWith("_millicents")) {
        payload[field.key] = Math.round(Number(value) * 100000);
      } else {
        payload[field.key] = Math.round(Number(value) * 100);
      }
    } else {
      payload[field.key] = value;
    }
  }

  if (feature.ownerScoped) {
    payload.owner_id = user.id;
  }
  payload.updated_at = new Date().toISOString();
  return { ok: true as const, payload };
}

// Wraps a query promise so two independent reads can run in parallel (as the
// Supabase version did with Promise.all) while each failure is captured the
// same way `{ data, error }` used to be: a null-ish result plus a message,
// instead of one query's rejection dropping the other's result.
function safeQuery<T>(
  promise: Promise<T>,
): Promise<{ data: T | null; error: string | null }> {
  return promise.then(
    (data) => ({ data, error: null }),
    (err: unknown) => ({ data: null, error: messageFrom(err) }),
  );
}

export async function loadFeature(db: Sql, slug: string, user: FeatureUser) {
  const feature = getFeature(slug);
  const [column, direction = "asc"] = feature.orderBy.split(".");
  const orderDirection = direction === "desc" ? db`desc` : db`asc`;

  const rowsQuery = feature.ownerScoped
    ? db<Record<string, unknown>[]>`
        select * from ${db(feature.table)}
        where owner_id = ${user.id}
        order by ${db(column)} ${orderDirection}
        limit 100
      `
    : db<Record<string, unknown>[]>`
        select * from ${db(feature.table)}
        order by ${db(column)} ${orderDirection}
        limit 100
      `;

  const motorcyclesQuery = db<
    Array<{ id: string; name: string; brand: string; model: string }>
  >`
    select id, name, brand, model from motorcycles
    where owner_id = ${user.id} and is_active = true and deleted_at is null
    order by name
  `;

  const [rowsResult, motorcyclesResult] = await Promise.all([
    safeQuery(rowsQuery),
    safeQuery(motorcyclesQuery),
  ]);

  return {
    feature,
    rows: rowsResult.data ?? [],
    motorcycles: motorcyclesResult.data ?? [],
    errorMessage: rowsResult.error ?? motorcyclesResult.error ?? "",
  };
}

export function featureActions(slug: string): Actions {
  return {
    default: async ({ request, locals, platform }) => {
      if (!locals.user) {
        return fail(401, { message: "Authentication required." });
      }
      const feature = getFeature(slug);
      const formData = await request.formData();
      const intent = String(formData.get("_intent") ?? "create");
      const id = String(formData.get("id") ?? "");
      const ownerId = locals.user.id;

      if (intent === "delete") {
        if (!id) return fail(400, { message: "Missing record id." });

        let deleted:
          | {
              existing: { motorcycle_id: string | null } | undefined;
              objectKeys: string[];
            }
          | undefined;
        try {
          deleted = await locals.db.begin(async (transaction) => {
            const db = transaction as unknown as typeof locals.db;
            const [existing] = await db<
              Array<{ motorcycle_id: string | null }>
            >`
              select motorcycle_id from ${db(feature.table)}
              where id = ${id} and owner_id = ${ownerId}
              for update
            `;
            if (!existing) return { existing, objectKeys: [] };

            const files = await db<Array<{ object_key: string }>>`
              select object_key from object_files
              where owner_id = ${ownerId}
                and source_table = ${feature.table}
                and source_id = ${id}
            `;
            await enqueueObjectDeletions(
              db,
              ownerId,
              files.map((file) => file.object_key),
            );
            await db`
              delete from ${db(feature.table)}
              where id = ${id} and owner_id = ${ownerId}
            `;
            await db`
              delete from object_files
              where owner_id = ${ownerId}
                and source_table = ${feature.table}
                and source_id = ${id}
            `;
            return {
              existing,
              objectKeys: files.map((file) => file.object_key),
            };
          });
        } catch (err) {
          return fail(400, { message: messageFrom(err) });
        }

        await deleteQueuedObjectsBestEffort({
          db: locals.db,
          objectKeys: deleted.objectKeys,
          ownerId,
          platform,
        });

        await syncRecordDeleteEffects({
          db: locals.db,
          ownerId,
          feature,
          recordId: id,
          existing: (deleted.existing ?? {}) as Record<string, unknown>,
        });
        return { ok: true };
      }

      const normalized = normalizeFeaturePayload(
        feature,
        formData,
        locals.user,
      );
      if (!normalized.ok) {
        return fail(400, {
          message: "Invalid form data.",
          errors: normalized.errors,
        });
      }

      const payload = normalized.payload;
      const recordId =
        intent === "update" && id
          ? id
          : String(payload.id ?? crypto.randomUUID());
      payload.id = recordId;

      const creating = !(intent === "update" && id);
      if (creating && feature.slug === "reminders") {
        const blocked = await assertCanCreateReminder(locals.db, ownerId);
        if (blocked) return fail(403, { message: blocked });
      }
      if (creating && feature.slug === "trabalho") {
        const blocked = await assertCanCreateWorkSession(locals.db, ownerId);
        if (blocked) return fail(403, { message: blocked });
      }

      const uploadedObjects: Array<{
        objectKey: string;
        filename: string;
        contentType: string;
        byteSize: number;
      }> = [];
      for (const field of feature.fields.filter(
        (item) => item.kind === "file",
      )) {
        const file = formData.get(field.key);
        if (!(file instanceof File) || file.size === 0) continue;
        const blocked = await assertCanCreateUpload(locals.db, ownerId);
        if (blocked) return fail(403, { message: blocked });
        let uploaded;
        try {
          uploaded = await uploadObjectFile({
            file,
            module: feature.slug,
            ownerId,
            platform,
          });
        } catch (err) {
          await queueUploadedOrphansBestEffort({
            db: locals.db,
            objectKeys: uploadedObjects.map((item) => item.objectKey),
            ownerId,
            platform,
          });
          return fail(400, { message: messageFrom(err) });
        }
        payload[field.key] = uploaded.objectKey;
        uploadedObjects.push(uploaded);
      }

      let replacedObjectKeys: string[] = [];
      try {
        replacedObjectKeys = await locals.db.begin(async (transaction) => {
          const db = transaction as unknown as typeof locals.db;
          let oldKeys: string[] = [];
          if (uploadedObjects.length > 0 && intent === "update" && id) {
            const oldFiles = await db<Array<{ object_key: string }>>`
              select object_key from object_files
              where owner_id = ${ownerId}
                and source_table = ${feature.table}
                and source_id = ${id}
              for update
            `;
            oldKeys = oldFiles.map((file) => file.object_key);
            await enqueueObjectDeletions(db, ownerId, oldKeys);
            await db`
              delete from object_files
              where owner_id = ${ownerId}
                and source_table = ${feature.table}
                and source_id = ${id}
            `;
          }

          for (const uploaded of uploadedObjects) {
            await db`
              insert into object_files ${db({
                owner_id: ownerId,
                module: feature.slug,
                source_table: feature.table,
                source_id: recordId,
                object_key: uploaded.objectKey,
                filename: uploaded.filename,
                content_type: uploaded.contentType,
                byte_size: uploaded.byteSize,
              })}
            `;
          }

          if (intent === "update" && id) {
            const updated = await db<Array<{ id: string }>>`
              update ${db(feature.table)}
              set ${db(payload)}
              where id = ${id} and owner_id = ${ownerId}
              returning id
            `;
            if (!updated[0]) throw new Error("Record not found.");
          } else {
            await db`
              insert into ${db(feature.table)} ${db(payload)}
            `;
          }
          return oldKeys;
        });
      } catch (err) {
        await queueUploadedOrphansBestEffort({
          db: locals.db,
          objectKeys: uploadedObjects.map((file) => file.objectKey),
          ownerId,
          platform,
        });
        return fail(400, { message: messageFrom(err) });
      }

      await deleteQueuedObjectsBestEffort({
        db: locals.db,
        objectKeys: replacedObjectKeys,
        ownerId,
        platform,
      });

      await syncRecordEffects({
        db: locals.db,
        ownerId,
        feature,
        recordId,
        payload,
      });
      return { ok: true };
    },
  };
}
