import type { Locale } from "$lib/i18n";
import type { AuthSession, AuthUser } from "$server/auth/session";

declare global {
  namespace App {
    interface Platform {
      env?: {
        R2_BUCKET?: R2Bucket;
        HYPERDRIVE?: Hyperdrive;
        DATABASE_URL?: string;
        PUBLIC_NEON_AUTH_URL?: string;
        NEON_AUTH_JWKS_URL?: string;
        STRIPE_SECRET_KEY?: string;
        STRIPE_WEBHOOK_SECRET?: string;
        STRIPE_PRO_MONTHLY_PRICE_ID?: string;
        STRIPE_PRO_YEARLY_PRICE_ID?: string;
        MISTRAL_API_KEY?: string;
        PUBLIC_SITE_URL?: string;
        PUBLIC_VAPID_KEY?: string;
        VAPID_PRIVATE_KEY?: string;
        PUSH_ENCRYPTION_KEY?: string;
      };
      context: {
        waitUntil(promise: Promise<unknown>): void;
      };
      caches: CacheStorage & { default: Cache };
    }

    interface Locals {
      db: import("postgres").Sql;
      safeGetSession: () => Promise<{
        session: AuthSession | null;
        user: AuthUser | null;
      }>;
      session: AuthSession | null;
      user: AuthUser | null;
      locale: Locale;
    }
  }
}

export {};
