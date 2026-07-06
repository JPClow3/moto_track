import { createClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database";
import { requirePublicSupabaseEnv, requireServiceRoleKey } from "$server/env";

export function createSupabaseAdminClient() {
  const { url } = requirePublicSupabaseEnv();
  return createClient<Database>(url, requireServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
