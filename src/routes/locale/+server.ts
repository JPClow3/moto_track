import { error, redirect } from "@sveltejs/kit";
import { LOCALE_COOKIE, normalizeLocale } from "$lib/i18n";

/**
 * A plain form POST rather than a fetch, so switching language works with
 * JavaScript disabled. Unauthenticated on purpose: visitors read the marketing
 * pages before they ever have an account.
 */
export async function POST({ request, cookies, url }) {
  const form = await request.formData();
  const locale = normalizeLocale(form.get("locale"));
  if (!locale) throw error(400, "Unsupported locale.");

  cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Only ever bounce back to a path on this origin — `redirectTo` comes from
  // the request, so honouring an absolute URL here would be an open redirect.
  const target = String(form.get("redirectTo") ?? "/");
  const safe =
    target.startsWith("/") && !target.startsWith("//") ? target : "/";
  throw redirect(303, safe || url.pathname);
}
