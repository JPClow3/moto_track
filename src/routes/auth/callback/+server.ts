import { redirect, type RequestHandler } from "@sveltejs/kit";
import { safeInternalRedirect } from "$server/auth-redirect";
import { completeSocialSignIn } from "$server/auth/session";

export const GET: RequestHandler = async (event) => {
  const { url } = event;
  const redirectTo = safeInternalRedirect(url.searchParams.get("next"));
  const verifier = url.searchParams.get("neon_auth_session_verifier");

  if (!verifier) {
    throw redirect(303, oauthFailureRedirect(redirectTo));
  }

  const result = await completeSocialSignIn(event, verifier).catch(() => ({
    ok: false as const,
    message: "OAuth session verification failed.",
  }));
  if (!result.ok) {
    throw redirect(303, oauthFailureRedirect(redirectTo));
  }

  throw redirect(303, redirectTo);
};

function oauthFailureRedirect(redirectTo: string) {
  const params = new URLSearchParams({
    redirectTo,
    error: "oauth_callback_failed",
  });
  return `/auth?${params.toString()}`;
}
