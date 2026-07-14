import { redirect } from "@sveltejs/kit";
import { s as safeInternalRedirect } from "../../../../chunks/auth-redirect.js";
async function GET({ url, locals }) {
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
    if (error) throw redirect(303, "/auth?error=confirmation_failed");
  }
  throw redirect(303, safeInternalRedirect(url.searchParams.get("next")));
}
export {
  GET
};
