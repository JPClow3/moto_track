import { error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "$server/supabase/admin";
import { shareTokenHash } from "$server/domain/sale-report-share";

export async function requireApiUser(
  event: RequestEvent,
): Promise<{ user: User; via: "session" | "token" }> {
  if (event.locals.user) {
    return { user: event.locals.user, via: "session" };
  }

  const header = event.request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw error(401, "Authentication required.");

  const token = match[1].trim();
  const keyHash = await shareTokenHash(token);
  const admin = createSupabaseAdminClient(event.platform);
  const { data, error: lookupError } = await admin
    .from("api_tokens")
    .select("id, owner_id, is_active")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (lookupError) throw error(500, "Unable to validate API token.");
  if (!data?.is_active || !data.owner_id) {
    throw error(401, "Invalid or inactive API token.");
  }

  await admin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    user: { id: data.owner_id } as User,
    via: "token",
  };
}
