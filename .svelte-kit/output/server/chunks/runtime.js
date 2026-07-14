import { b as private_env, p as public_env } from "./shared-server.js";
function stringValue(source, key) {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value : void 0;
}
function resolveRuntimeEnv(bindings, fallback) {
  const keys = [
    "PUBLIC_SUPABASE_URL",
    "PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_MONTHLY_PRICE_ID",
    "STRIPE_PRO_YEARLY_PRICE_ID",
    "MISTRAL_API_KEY",
    "PUBLIC_SITE_URL",
    "PUBLIC_VAPID_KEY",
    "VAPID_PRIVATE_KEY",
    "PUSH_ENCRYPTION_KEY"
  ];
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = stringValue(bindings, key) ?? stringValue(fallback, key);
      return value ? [[key, value]] : [];
    })
  );
}
function runtimeEnv(platform) {
  return resolveRuntimeEnv(platform?.env, { ...public_env, ...private_env });
}
export {
  runtimeEnv as r
};
