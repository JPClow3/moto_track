import { runtimeEnv } from "$server/runtime";

export function requirePublicSupabaseEnv(platform?: App.Platform) {
  const runtime = runtimeEnv(platform);
  const url = runtime.PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const anonKey = runtime.PUBLIC_SUPABASE_ANON_KEY || "local-anon-key";
  return {
    url,
    anonKey,
  };
}

export function requireServiceRoleKey(platform?: App.Platform) {
  const key = runtimeEnv(platform).SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be configured for service-role operations.",
    );
  }
  return key;
}

export function siteUrl(platform?: App.Platform) {
  return runtimeEnv(platform).PUBLIC_SITE_URL || "http://localhost:5173";
}
