import { localizedActions } from "$server/domain/localized-actions";
import { fail, type Actions } from "@sveltejs/kit";
import type { Sql } from "postgres";
import { getFeature, schemaForFeature, type FeatureConfig } from "./features";
import {
  DOCUMENT_UPLOAD_CONTENT_TYPES,
  MAX_DOCUMENT_UPLOAD_BYTES,
  deleteQueuedObjectsBestEffort,
  enqueueObjectDeletions,
  lockObjectOwner,
  queueUploadedOrphansBestEffort,
  uploadObjectFile,
} from "$server/r2/files";
import { parseLocalizedNumber } from "$server/domain/fuel";
import { syncMotorcycleOdometer } from "$server/domain/odometer";
import { syncLinkedReminder } from "$server/domain/record-sync";
import { relativeReplacementMonths } from "$server/domain/maintenance-schedule";
import {
  REMINDER_NOTIFICATION_RESET,
  reminderScheduleChanged,
} from "$server/domain/reminders";
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

const ODOMETER_RECORD_TABLES = new Set([
  "fuel_records",
  "maintenance_records",
  "tire_records",
  "work_sessions",
]);

export function recordTracksOdometer(table: string) {
  return ODOMETER_RECORD_TABLES.has(table);
}

/** The FK proves existence only; it does not prove this authenticated owner. */
export async function assertOwnedMotorcycleReference(
  db: Sql,
  ownerId: string,
  value: unknown,
  { required = false }: { required?: boolean } = {},
) {
  if (value === null || value === undefined || value === "") {
    if (required) throw new Error("Moto não encontrada.");
    return;
  }
  if (typeof value !== "string" || !value.trim())
    throw new Error("Moto não encontrada.");
  const [motorcycle] = await db<Array<{ id: string }>>`
    select id from motorcycles
    where id = ${value} and owner_id = ${ownerId} and deleted_at is null
    for share
  `;
  if (!motorcycle) throw new Error("Moto não encontrada.");
}

export async function assertFeatureReferences(
  db: Sql,
  ownerId: string,
  feature: FeatureConfig,
  payload: Record<string, unknown>,
) {
  for (const field of feature.fields) {
    if (field.source === "motorcycles") {
      await assertOwnedMotorcycleReference(db, ownerId, payload[field.key], {
        required: field.required,
      });
    }
  }
}

/** A correction can remove the highest reading from its previous motorcycle. */
export async function syncChangedRecordOdometers(
  db: Sql,
  ownerId: string,
  payload: Record<string, unknown>,
  previous: Record<string, unknown> = {},
) {
  const ids = new Set([motorcycleIdFrom(previous), motorcycleIdFrom(payload)]);
  for (const id of ids) {
    if (id) await syncMotorcycleOdometer(db, ownerId, id, { strict: true });
  }
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
  syncOdometer = true,
}: {
  db: Sql;
  ownerId: string;
  feature: FeatureConfig;
  recordId: string;
  payload: Record<string, unknown>;
  syncOdometer?: boolean;
}) {
  const motorcycleId = motorcycleIdFrom(payload);
  if (motorcycleId && syncOdometer) {
    await syncMotorcycleOdometer(db, ownerId, motorcycleId, { strict: true });
  }
  await syncLinkedReminder(db, ownerId, feature.table, recordId, payload);
}

export async function syncRecordDeleteEffects({
  db,
  ownerId,
  feature,
  recordId,
  existing,
  strictOdometer = false,
}: {
  db: Sql;
  ownerId: string;
  feature: FeatureConfig;
  recordId: string;
  existing: Record<string, unknown>;
  strictOdometer?: boolean;
}) {
  await syncLinkedReminder(db, ownerId, feature.table, recordId, {});
  const motorcycleId = motorcycleIdFrom(existing);
  if (motorcycleId && recordTracksOdometer(feature.table)) {
    await syncMotorcycleOdometer(db, ownerId, motorcycleId, {
      strict: strictOdometer,
    });
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
    // Deletes can cascade or fire triggers into linked plans and reminders;
    // take the owner lock first, as reminder completion and account deletion do.
    await db.begin(async (tx) => {
      await lockObjectOwner(tx as unknown as Sql, ownerId);
      await tx`
        delete from ${tx(table)}
        where id = ${id} and owner_id = ${ownerId}
      `;
    });
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

  if (feature.table === "maintenance_records") {
    const planId = String(
      formData.get("maintenance_plan_item_id") ?? "",
    ).trim();
    const rawMilestone = String(
      formData.get("completed_milestone") ?? "",
    ).trim();
    const milestone = rawMilestone ? Number(rawMilestone) : null;
    if (
      (planId &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          planId,
        )) ||
      (milestone !== null &&
        (!planId ||
          !Number.isInteger(milestone) ||
          milestone < 1 ||
          milestone > 10_000))
    )
      return {
        ok: false as const,
        errors: { completed_milestone: ["Informe uma etapa válida do plano."] },
      };
    payload.maintenance_plan_item_id = planId || null;
    payload.completed_milestone = milestone;
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
  return localizedActions({
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
            await lockObjectOwner(db, ownerId);
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
            await syncRecordDeleteEffects({
              db,
              ownerId,
              feature,
              recordId: id,
              existing,
              strictOdometer: true,
            });
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
        const blocked = await assertCanCreateReminder(
          locals.db,
          ownerId,
          platform,
        );
        if (blocked) return fail(403, { message: blocked });
      }
      if (creating && feature.slug === "trabalho") {
        const blocked = await assertCanCreateWorkSession(
          locals.db,
          ownerId,
          new Date(),
          platform,
        );
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
        const blocked = await assertCanCreateUpload(
          locals.db,
          ownerId,
          platform,
        );
        if (blocked) return fail(403, { message: blocked });
        let uploaded;
        try {
          uploaded = await uploadObjectFile({
            file,
            module: feature.slug,
            ownerId,
            platform,
            policy: {
              maxBytes: MAX_DOCUMENT_UPLOAD_BYTES,
              allowedContentTypes: DOCUMENT_UPLOAD_CONTENT_TYPES,
            },
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
          const tracksOdometer = ODOMETER_RECORD_TABLES.has(feature.table);
          if (tracksOdometer || feature.fields.some((field) => field.source))
            await lockObjectOwner(db, ownerId);
          await assertFeatureReferences(db, ownerId, feature, payload);
          let previous: Record<string, unknown> = {};
          if (
            intent === "update" &&
            id &&
            (tracksOdometer || feature.table === "reminders")
          ) {
            const [row] = await db<Array<Record<string, unknown>>>`
              select * from ${db(feature.table)}
              where id = ${id} and owner_id = ${ownerId} for update
            `;
            if (!row) throw new Error("Record not found.");
            previous = row;
            if (feature.table === "reminders") {
              payload.completion_version =
                Number(row.completion_version ?? 0) + 1;
              if (reminderScheduleChanged(row, payload))
                Object.assign(payload, REMINDER_NOTIFICATION_RESET);
            }
          }
          if (
            feature.table === "maintenance_records" &&
            payload.maintenance_plan_item_id
          ) {
            const [plan] = await db<
              Array<{
                maintenance_type: string;
                schedule_milestones: unknown[];
                recurrence_km: number | null;
                recurrence_months: number | null;
                calendar_anchor_mode: string;
              }>
            >`
              select maintenance_type, schedule_milestones, recurrence_km, recurrence_months, calendar_anchor_mode from maintenance_plan_items
              where id = ${String(payload.maintenance_plan_item_id)} and owner_id = ${ownerId}
                and motorcycle_id = ${String(payload.motorcycle_id ?? "")} and is_active = true
              for update
            `;
            if (!plan)
              throw new Error("Plano de manutenção inválido para esta moto.");
            if (
              plan.schedule_milestones.length &&
              payload.completed_milestone === null &&
              relativeReplacementMonths({
                milestones: plan.schedule_milestones,
                recurrenceKm: plan.recurrence_km,
                recurrenceMonths: plan.recurrence_months,
                calendarAnchorMode: plan.calendar_anchor_mode,
              }) === null
            )
              throw new Error("Informe qual etapa de revisão foi realizada.");
            payload.maintenance_type = plan.maintenance_type;
          }
          let oldKeys: string[] = [];
          if (uploadedObjects.length > 0) {
            await lockObjectOwner(db, ownerId);
          }
          if (uploadedObjects.length > 0 && intent === "update" && id) {
            await db`
              select id from ${db(feature.table)}
              where id = ${id} and owner_id = ${ownerId}
              for update
            `;
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
          if (tracksOdometer) {
            await syncChangedRecordOdometers(db, ownerId, payload, previous);
          }
          await syncRecordEffects({
            db,
            ownerId,
            feature,
            recordId,
            payload,
            syncOdometer: false,
          });
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

      return { ok: true };
    },
  });
}
