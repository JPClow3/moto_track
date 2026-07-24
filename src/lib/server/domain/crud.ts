import { fail, type Actions } from "@sveltejs/kit";
import type { Sql } from "postgres";
import { getFeature, schemaForFeature, type FeatureConfig } from "./features";
import { uploadObjectFile } from "$server/r2/files";
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

        let existing: { motorcycle_id: string | null } | undefined;
        try {
          [existing] = await locals.db<Array<{ motorcycle_id: string | null }>>`
            select motorcycle_id from ${locals.db(feature.table)}
            where id = ${id} and owner_id = ${ownerId}
          `;
        } catch (err) {
          return fail(400, { message: messageFrom(err) });
        }

        try {
          await locals.db`
            delete from ${locals.db(feature.table)}
            where id = ${id} and owner_id = ${ownerId}
          `;
        } catch (err) {
          return fail(400, { message: messageFrom(err) });
        }

        await syncRecordDeleteEffects({
          db: locals.db,
          ownerId,
          feature,
          recordId: id,
          existing: (existing ?? {}) as Record<string, unknown>,
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

      for (const field of feature.fields.filter(
        (item) => item.kind === "file",
      )) {
        const file = formData.get(field.key);
        if (!(file instanceof File) || file.size === 0) continue;
        const blocked = await assertCanCreateUpload(locals.db, ownerId);
        if (blocked) return fail(403, { message: blocked });
        const uploaded = await uploadObjectFile({
          file,
          module: feature.slug,
          ownerId,
          platform,
        });
        payload[field.key] = uploaded.objectKey;
        try {
          await locals.db`
            insert into object_files ${locals.db({
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
        } catch (err) {
          return fail(400, { message: messageFrom(err) });
        }
      }

      try {
        if (intent === "update" && id) {
          await locals.db`
            update ${locals.db(feature.table)}
            set ${locals.db(payload)}
            where id = ${id} and owner_id = ${ownerId}
          `;
        } else {
          await locals.db`
            insert into ${locals.db(feature.table)} ${locals.db(payload)}
          `;
        }
      } catch (err) {
        return fail(400, { message: messageFrom(err) });
      }

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
