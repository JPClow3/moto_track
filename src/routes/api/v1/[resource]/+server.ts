import { json, error } from "@sveltejs/kit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database";
import { getFeature } from "$server/domain/features";
import { normalizeApiFeaturePayload } from "$server/domain/api-write";
import { requireApiUser } from "$server/domain/api-auth";
import { createSupabaseAdminClient } from "$server/supabase/admin";
import { assertCanCreateReminder } from "$server/domain/entitlement-guards";

const apiResources: Record<string, { table: string; featureSlug?: string }> = {
  "fuel-records": { table: "fuel_records" },
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
  if (!config.featureSlug) {
    throw error(
      405,
      "Writes for this resource are not supported via API v1 yet.",
    );
  }
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
  return json({ result: data }, { status: 201 });
}

export async function PATCH(event) {
  const { user, via } = await requireApiUser(event);
  const config = await resourceOrThrow(event.params.resource);
  if (!config.featureSlug) {
    throw error(
      405,
      "Writes for this resource are not supported via API v1 yet.",
    );
  }
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
  return json({ result: data });
}

export async function DELETE(event) {
  const { user, via } = await requireApiUser(event);
  const config = await resourceOrThrow(event.params.resource);
  const supabase = dbFor(event, via);
  const url = new URL(event.request.url);
  const id = url.searchParams.get("id");
  if (!id) throw error(400, "Query parameter id is required.");
  const { error: dbError } = await supabase
    .from(config.table)
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (dbError) throw error(400, dbError.message);
  return json({ ok: true });
}
