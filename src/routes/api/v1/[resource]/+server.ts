import { json, error } from "@sveltejs/kit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database";
import { getFeature } from "$server/domain/features";
import { normalizeApiFeaturePayload } from "$server/domain/api-write";
import { requireApiUser } from "$server/domain/api-auth";
import { createSupabaseAdminClient } from "$server/supabase/admin";
import { assertCanCreateReminder } from "$server/domain/entitlement-guards";
import { syncRecordEffects } from "$server/domain/crud";
import { syncMotorcycleOdometer } from "$server/domain/odometer";
import { syncLinkedReminder } from "$server/domain/record-sync";

const apiResources: Record<string, { table: string; featureSlug: string }> = {
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

function dbFor(
  event: {
    locals: App.Locals;
    platform: App.Platform | undefined;
  },
  via: "session" | "token",
): SupabaseClient<Database> {
  return via === "token"
    ? createSupabaseAdminClient(event.platform)
    : event.locals.supabase;
}

async function resourceOrThrow(resource: string) {
  const config = apiResources[resource];
  if (!config) throw error(404, "Unknown API resource");
  return config;
}

export async function GET(event) {
  const { user, via } = await requireApiUser(event);
  const config = await resourceOrThrow(event.params.resource);
  const supabase = dbFor(event, via);
  const { data, error: dbError } = await supabase
    .from(config.table)
    .select("*")
    .eq("owner_id", user.id)
    .limit(500);
  if (dbError) throw error(400, dbError.message);
  return json({ results: data ?? [] });
}

export async function POST(event) {
  const { user, via } = await requireApiUser(event);
  const config = await resourceOrThrow(event.params.resource);
  const supabase = dbFor(event, via);
  if (config.featureSlug === "reminders") {
    const blocked = await assertCanCreateReminder(supabase, user.id);
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
  const { data, error: dbError } = await supabase
    .from(config.table)
    .insert(payload as never)
    .select("*")
    .maybeSingle();
  if (dbError) throw error(400, dbError.message);
  await syncRecordEffects({
    supabase,
    ownerId: user.id,
    feature,
    recordId: String(payload.id),
    payload,
  });
  return json({ result: data }, { status: 201 });
}

export async function PATCH(event) {
  const { user, via } = await requireApiUser(event);
  const config = await resourceOrThrow(event.params.resource);
  const supabase = dbFor(event, via);
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
  const { data, error: dbError } = await supabase
    .from(config.table)
    .update(normalized.payload as never)
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("*")
    .maybeSingle();
  if (dbError) throw error(400, dbError.message);
  if (!data) throw error(404, "Record not found.");
  await syncRecordEffects({
    supabase,
    ownerId: user.id,
    feature,
    recordId: id,
    payload: normalized.payload,
  });
  return json({ result: data });
}

export async function DELETE(event) {
  const { user, via } = await requireApiUser(event);
  const config = await resourceOrThrow(event.params.resource);
  const supabase = dbFor(event, via);
  const feature = getFeature(config.featureSlug);
  const url = new URL(event.request.url);
  const id = url.searchParams.get("id");
  if (!id) throw error(400, "Query parameter id is required.");
  const { data: existing, error: readError } = await supabase
    .from(config.table)
    .select("motorcycle_id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError) throw error(400, readError.message);
  if (!existing) throw error(404, "Record not found.");
  const { error: dbError } = await supabase
    .from(config.table)
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (dbError) throw error(400, dbError.message);
  await syncLinkedReminder(supabase, user.id, feature.table, id, {});
  const motorcycleId =
    typeof (existing as { motorcycle_id?: unknown }).motorcycle_id === "string"
      ? (existing as { motorcycle_id: string }).motorcycle_id
      : null;
  if (motorcycleId) {
    await syncMotorcycleOdometer(supabase, user.id, motorcycleId);
  }
  return json({ ok: true });
}
