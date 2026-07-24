import { redirect, type Handle } from "@sveltejs/kit";
import { getDb } from "$server/db/client";
import { resolveSession } from "$server/auth/session";
import { ensureAccount } from "$server/auth/bootstrap";
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

  event.locals.db = getDb(event.platform);

  const { session, user } = await resolveSession(event);
  event.locals.session = session;
  event.locals.user = user;
  event.locals.safeGetSession = async () => ({ session, user });

  // Provision the app-side profile/subscription rows that Supabase used to
  // seed from an auth.users trigger.
  if (user) {
    await ensureAccount(event.locals.db, user.id, user.email);
  }

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
  });
};
