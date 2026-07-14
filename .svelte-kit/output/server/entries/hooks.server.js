import { redirect } from "@sveltejs/kit";
import { createServerClient } from "@supabase/ssr";
import { r as requirePublicSupabaseEnv } from "../chunks/env.js";
function createSupabaseServerClient(event) {
  const { url, anonKey } = requirePublicSupabaseEnv(event.platform);
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          event.cookies.set(name, value, {
            ...options,
            path: options.path ?? "/"
          });
        }
      }
    }
  });
}
const protectedPrefixes = [
  "/dashboard",
  "/garage",
  "/fuel",
  "/maintenance",
  "/tires",
  "/documents",
  "/reminders",
  "/expenses",
  "/reports",
  "/trabalho",
  "/billing/conta",
  "/admin"
];
const handle = async ({ event, resolve }) => {
  event.locals.supabase = createSupabaseServerClient(event);
  event.locals.safeGetSession = async () => {
    const {
      data: { session: session2 }
    } = await event.locals.supabase.auth.getSession();
    if (!session2) {
      return { session: null, user: null };
    }
    const {
      data: { user: user2 },
      error
    } = await event.locals.supabase.auth.getUser();
    if (error) {
      return { session: null, user: null };
    }
    return { session: session2, user: user2 };
  };
  const { session, user } = await event.locals.safeGetSession();
  event.locals.session = session;
  event.locals.user = user;
  if (protectedPrefixes.some((prefix) => event.url.pathname.startsWith(prefix)) && !user) {
    throw redirect(
      303,
      `/auth?redirectTo=${encodeURIComponent(event.url.pathname)}`
    );
  }
  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === "content-range" || name === "x-supabase-api-version";
    }
  });
};
export {
  handle
};
