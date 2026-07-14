import { createClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database";
import { requirePublicSupabaseEnv, requireServiceRoleKey } from "$server/env";

export function createSupabaseAdminClient(platform?: App.Platform) {
  const { url } = requirePublicSupabaseEnv(platform);
  return createClient<Database>(url, requireServiceRoleKey(platform), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
