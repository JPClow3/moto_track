import { createClient } from "@supabase/supabase-js";
import { r as requirePublicSupabaseEnv, a as requireServiceRoleKey } from "./env.js";
function createSupabaseAdminClient(platform) {
  const { url } = requirePublicSupabaseEnv(platform);
  return createClient(url, requireServiceRoleKey(platform), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
export {
  createSupabaseAdminClient as c
};
