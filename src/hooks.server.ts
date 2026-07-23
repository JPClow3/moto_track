import { redirect, type Handle } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$server/supabase/server";
import { LOCALE_COOKIE, resolveLocale } from "$lib/i18n";

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
  // Its load reads locals.user!.id, so an unauthenticated hit threw a 500
  // instead of redirecting to sign-in.
  "/onboarding",
  "/billing/conta",
  "/billing/portal",
  "/billing/checkout",
  "/admin",
];

/**
 * Carve-outs that sit *under* a protected prefix but must stay reachable
 * without a session. The sale dossier share link lives at
 * /reports/sale/public/<token> — it is bearer-authenticated by the token itself
 * and its whole purpose is to be opened by a prospective buyer who has no
 * account. Without this, "/reports" bounced every visitor to /auth.
 */
const publicPrefixes = ["/reports/sale/public/"];

export const handle: Handle = async ({ event, resolve }) => {
  // Resolved before anything can redirect, so even the sign-in bounce and the
  // error page render in the reader's language.
  event.locals.locale = resolveLocale(
    event.cookies.get(LOCALE_COOKIE),
    event.request.headers.get("accept-language"),
  );

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

  const isPublic = publicPrefixes.some((prefix) =>
    event.url.pathname.startsWith(prefix),
  );

  if (
    !isPublic &&
    protectedPrefixes.some((prefix) => event.url.pathname.startsWith(prefix)) &&
    !user
  ) {
    throw redirect(
      303,
      `/auth?redirectTo=${encodeURIComponent(event.url.pathname)}`,
    );
  }

  return resolve(event, {
    // app.html ships `lang="%lang%"`; without this the document would claim to
    // be pt-BR to screen readers and translation tools no matter the locale.
    transformPageChunk: ({ html }) =>
      html.replace("%lang%", event.locals.locale),
    filterSerializedResponseHeaders(name) {
      return name === "content-range" || name === "x-supabase-api-version";
    },
  });
};
