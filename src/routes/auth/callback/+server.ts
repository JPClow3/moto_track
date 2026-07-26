import { redirect, type RequestHandler } from "@sveltejs/kit";
import { safeInternalRedirect } from "$server/auth-redirect";
import { completeSocialSignIn } from "$server/auth/session";

export const GET: RequestHandler = async (event) => {
  const { url } = event;
  const verifier = url.searchParams.get("neon_auth_session_verifier");
  if (verifier) {
    const result = await completeSocialSignIn(event, verifier);
    if (!result.ok) {
      throw redirect(303, "/auth?redirectTo=/dashboard");
    }
  }
  throw redirect(303, safeInternalRedirect(url.searchParams.get("next")));
};
