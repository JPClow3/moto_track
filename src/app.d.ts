import type { SupabaseClient, Session, User } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database";

declare global {
  namespace App {
    interface Platform {
      env?: {
        R2_BUCKET?: R2Bucket;
        SUPABASE_URL?: string;
        SUPABASE_ANON_KEY?: string;
        SUPABASE_SERVICE_ROLE_KEY?: string;
        STRIPE_SECRET_KEY?: string;
        STRIPE_WEBHOOK_SECRET?: string;
        PUBLIC_SITE_URL?: string;
      };
      context: {
        waitUntil(promise: Promise<unknown>): void;
      };
      caches: CacheStorage & { default: Cache };
    }

    interface Locals {
      supabase: SupabaseClient<Database>;
      safeGetSession: () => Promise<{
        session: Session | null;
        user: User | null;
      }>;
      session: Session | null;
      user: User | null;
    }
  }
}

export {};
