import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

export type RuntimeEnv = {
  DATABASE_URL?: string;
  PUBLIC_NEON_AUTH_URL?: string;
  NEON_AUTH_JWKS_URL?: string;
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_ENVIRONMENT?: "test_mode" | "live_mode";
  DODO_PAYMENTS_WEBHOOK_SECRET?: string;
  DODO_PRO_MONTHLY_PRODUCT_ID?: string;
  DODO_PRO_YEARLY_PRODUCT_ID?: string;
  MISTRAL_API_KEY?: string;
  PUBLIC_SITE_URL?: string;
  PUBLIC_VAPID_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  PUSH_ENCRYPTION_KEY?: string;
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
    "DATABASE_URL",
    "PUBLIC_NEON_AUTH_URL",
    "NEON_AUTH_JWKS_URL",
    "DODO_PAYMENTS_API_KEY",
    "DODO_PAYMENTS_ENVIRONMENT",
    "DODO_PAYMENTS_WEBHOOK_SECRET",
    "DODO_PRO_MONTHLY_PRODUCT_ID",
    "DODO_PRO_YEARLY_PRODUCT_ID",
    "MISTRAL_API_KEY",
    "PUBLIC_SITE_URL",
    "PUBLIC_VAPID_KEY",
    "VAPID_PRIVATE_KEY",
    "PUSH_ENCRYPTION_KEY",
  ];

  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = stringValue(bindings, key) ?? stringValue(fallback, key);
      if (
        key === "DODO_PAYMENTS_ENVIRONMENT" &&
        value !== "test_mode" &&
        value !== "live_mode"
      ) {
        return [];
      }
      return value ? [[key, value]] : [];
    }),
  ) as RuntimeEnv;
}

export function runtimeEnv(platform?: App.Platform): RuntimeEnv {
  return resolveRuntimeEnv(platform?.env, { ...publicEnv, ...privateEnv });
}
