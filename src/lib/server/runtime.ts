import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

export type RuntimeEnv = {
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRO_MONTHLY_PRICE_ID?: string;
  STRIPE_PRO_YEARLY_PRICE_ID?: string;
  MISTRAL_API_KEY?: string;
  PUBLIC_SITE_URL?: string;
};

type RuntimeSource = Record<string, unknown> | undefined;

function stringValue(source: RuntimeSource, key: keyof RuntimeEnv) {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function resolveRuntimeEnv(
  bindings?: RuntimeSource,
  fallback?: RuntimeSource,
): RuntimeEnv {
  const keys: Array<keyof RuntimeEnv> = [
    "PUBLIC_SUPABASE_URL",
    "PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_MONTHLY_PRICE_ID",
    "STRIPE_PRO_YEARLY_PRICE_ID",
    "MISTRAL_API_KEY",
    "PUBLIC_SITE_URL",
  ];

  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = stringValue(bindings, key) ?? stringValue(fallback, key);
      return value ? [[key, value]] : [];
    }),
  ) as RuntimeEnv;
}

export function runtimeEnv(platform?: App.Platform): RuntimeEnv {
  return resolveRuntimeEnv(platform?.env, { ...publicEnv, ...privateEnv });
}
