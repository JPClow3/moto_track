import { fail, type Actions } from "@sveltejs/kit";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getFeature, schemaForFeature, type FeatureConfig } from "./features";
import type { Database } from "$lib/types/database";
import { uploadObjectFile } from "$server/r2/files";
import { syncMotorcycleOdometer } from "$server/domain/odometer";
import { syncLinkedReminder } from "$server/domain/record-sync";
import {
  assertCanCreateReminder,
  assertCanCreateUpload,
  assertCanCreateWorkSession,
} from "$server/domain/entitlement-guards";

function motorcycleIdFrom(payload: Record<string, unknown>) {
  const value = payload.motorcycle_id;
  return typeof value === "string" && value ? value : null;
}

async function syncRecordEffects({
  supabase,
  ownerId,
  feature,
  recordId,
  payload,
}: {
  supabase: SupabaseClient<Database>;
  ownerId: string;
  feature: FeatureConfig;
  recordId: string;
  payload: Record<string, unknown>;
}) {
  const motorcycleId = motorcycleIdFrom(payload);
  if (motorcycleId) {
    await syncMotorcycleOdometer(supabase, ownerId, motorcycleId);
  }
  await syncLinkedReminder(supabase, ownerId, feature.table, recordId, payload);
}

export function normalizeFeaturePayload(
  feature: FeatureConfig,
  formData: FormData,
  user: User,
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

export async function loadFeature(
  supabase: SupabaseClient<Database>,
  slug: string,
  user: User,
) {
  const feature = getFeature(slug);
  const [column, direction = "asc"] = feature.orderBy.split(".");
  const db = supabase as unknown as {
    from: (table: string) => ReturnType<SupabaseClient<Database>["from"]>;
  };
  let query = db
    .from(feature.table)
    .select("*")
    .order(column, { ascending: direction !== "desc" })
    .limit(100);
  if (feature.ownerScoped) {
    query = query.eq("owner_id", user.id);
  }
  const [{ data, error }, { data: motorcycles, error: motorcyclesError }] =
    await Promise.all([
      query,
      supabase
        .from("motorcycles")
        .select("id, name, brand, model")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name"),
    ]);
  return {
    feature,
    rows: (data ?? []) as Array<Record<string, unknown>>,
    motorcycles: motorcycles ?? [],
    errorMessage: error?.message ?? motorcyclesError?.message ?? "",
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

      if (intent === "delete") {
        if (!id) return fail(400, { message: "Missing record id." });
        const db = locals.supabase as unknown as {
          from: (table: string) => ReturnType<SupabaseClient<Database>["from"]>;
        };
        const { data: existing, error: readError } = await db
          .from(feature.table)
          .select("motorcycle_id")
          .eq("id", id)
          .eq("owner_id", locals.user.id)
          .maybeSingle();
        if (readError) return fail(400, { message: readError.message });
        const { error } = await db
          .from(feature.table)
          .delete()
          .eq("id", id)
          .eq("owner_id", locals.user.id);
        if (error) return fail(400, { message: error.message });
        await syncLinkedReminder(
          locals.supabase,
          locals.user.id,
          feature.table,
          id,
          {},
        );
        const motorcycleId = motorcycleIdFrom(
          (existing ?? {}) as Record<string, unknown>,
        );
        if (motorcycleId) {
          await syncMotorcycleOdometer(
            locals.supabase,
            locals.user.id,
            motorcycleId,
          );
        }
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
          locals.supabase,
          locals.user.id,
        );
        if (blocked) return fail(403, { message: blocked });
      }
      if (creating && feature.slug === "trabalho") {
        const blocked = await assertCanCreateWorkSession(
          locals.supabase,
          locals.user.id,
        );
        if (blocked) return fail(403, { message: blocked });
      }

      for (const field of feature.fields.filter(
        (item) => item.kind === "file",
      )) {
        const file = formData.get(field.key);
        if (!(file instanceof File) || file.size === 0) continue;
        const blocked = await assertCanCreateUpload(
          locals.supabase,
          locals.user.id,
        );
        if (blocked) return fail(403, { message: blocked });
        const uploaded = await uploadObjectFile({
          file,
          module: feature.slug,
          ownerId: locals.user.id,
          platform,
        });
        payload[field.key] = uploaded.objectKey;
        const { error: fileError } = await locals.supabase
          .from("object_files")
          .insert({
            owner_id: locals.user.id,
            module: feature.slug,
            source_table: feature.table,
            source_id: recordId,
            object_key: uploaded.objectKey,
            filename: uploaded.filename,
            content_type: uploaded.contentType,
            byte_size: uploaded.byteSize,
          });
        if (fileError) return fail(400, { message: fileError.message });
      }

      const query =
        intent === "update" && id
          ? (
              locals.supabase as unknown as {
                from: (
                  table: string,
                ) => ReturnType<SupabaseClient<Database>["from"]>;
              }
            )
              .from(feature.table)
              .update(payload as never)
              .eq("id", id)
              .eq("owner_id", locals.user.id)
          : (
              locals.supabase as unknown as {
                from: (
                  table: string,
                ) => ReturnType<SupabaseClient<Database>["from"]>;
              }
            )
              .from(feature.table)
              .insert(payload as never);
      const { error } = await query;
      if (error) {
        return fail(400, { message: error.message });
      }
      await syncRecordEffects({
        supabase: locals.supabase,
        ownerId: locals.user.id,
        feature,
        recordId,
        payload,
      });
      return { ok: true };
    },
  };
}
