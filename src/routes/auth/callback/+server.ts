import { redirect } from "@sveltejs/kit";
import { safeInternalRedirect } from "$server/auth-redirect";

// Return target for Neon Auth social sign-in and email flows. Email/password
// auth establishes the session inline (see $server/auth/session), so this
// endpoint only needs to bounce the browser onward.
//
// NOTE(oauth): Neon Auth is hosted on a separate domain, so a social-login
// session cookie is set on the neonauth host, not this app's origin. Completing
// Google sign-in as a first-party session requires either the Neon Auth
// client-side SDK on the browser or a cross-domain/subdomain cookie setup in
// the Neon Auth project. Until that is configured, this callback cannot read
// the upstream session. Email/password sign-in is unaffected.
export async function GET({ url }) {
  throw redirect(303, safeInternalRedirect(url.searchParams.get("next")));
}
