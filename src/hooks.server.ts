import { redirect, type Handle } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$server/supabase/server";

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
  "/admin",
];

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createSupabaseServerClient(event);
  event.locals.safeGetSession = async () => {
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession();
    if (!session) {
      return { session: null, user: null };
    }

    const {
      data: { user },
      error,
    } = await event.locals.supabase.auth.getUser();
    if (error) {
      return { session: null, user: null };
    }
    return { session, user };
  };

  const { session, user } = await event.locals.safeGetSession();
  event.locals.session = session;
  event.locals.user = user;

  if (
    protectedPrefixes.some((prefix) => event.url.pathname.startsWith(prefix)) &&
    !user
  ) {
    throw redirect(
      303,
      `/auth?redirectTo=${encodeURIComponent(event.url.pathname)}`,
    );
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === "content-range" || name === "x-supabase-api-version";
    },
  });
};
