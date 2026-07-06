import { createServerClient } from "@supabase/ssr";
import type { RequestEvent } from "@sveltejs/kit";
import type { Database } from "$lib/types/database";
import { requirePublicSupabaseEnv } from "$server/env";

export function createSupabaseServerClient(event: RequestEvent) {
  const { url, anonKey } = requirePublicSupabaseEnv();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          event.cookies.set(name, value, {
            ...options,
            path: options.path ?? "/",
          });
        }
      },
    },
  });
}
