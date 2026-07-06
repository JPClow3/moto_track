import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

export function requirePublicSupabaseEnv() {
  const url = publicEnv.PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const anonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY || "local-anon-key";
  return {
    url,
    anonKey,
  };
}

export function requireServiceRoleKey() {
  const key = privateEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be configured for service-role operations.",
    );
  }
  return key;
}

export function siteUrl() {
  return privateEnv.PUBLIC_SITE_URL || "http://localhost:5173";
}
