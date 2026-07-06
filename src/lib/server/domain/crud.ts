import { fail, type Actions } from "@sveltejs/kit";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getFeature, schemaForFeature, type FeatureConfig } from "./features";
import type { Database } from "$lib/types/database";

export function normalizeFeaturePayload(
  feature: FeatureConfig,
  formData: FormData,
  user: User,
) {
  const raw: Record<string, unknown> = {};
  for (const field of feature.fields) {
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
  let query = supabase
    .from(feature.table)
    .select("*")
    .order(column, { ascending: direction !== "desc" })
    .limit(100);
  if (feature.ownerScoped) {
    query = query.eq("owner_id", user.id);
  }
  const { data, error } = await query;
  return {
    feature,
    rows: (data ?? []) as Array<Record<string, unknown>>,
    errorMessage: error?.message ?? "",
  };
}

export function featureActions(slug: string): Actions {
  return {
    default: async ({ request, locals }) => {
      if (!locals.user) {
        return fail(401, { message: "Authentication required." });
      }
      const feature = getFeature(slug);
      const formData = await request.formData();
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

      const { error } = await locals.supabase
        .from(feature.table)
        .insert(normalized.payload);
      if (error) {
        return fail(400, { message: error.message });
      }
      return { ok: true };
    },
  };
}
