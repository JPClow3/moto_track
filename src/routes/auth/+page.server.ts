import { fail, redirect, type Actions } from "@sveltejs/kit";
import { safeInternalRedirect } from "$server/auth-redirect";
import {
  signInEmail,
  signUpEmail,
  signOut,
  socialSignInUrl,
  requestPasswordReset,
} from "$server/auth/session";

export const actions: Actions = {
  signIn: async (event) => {
    const { request, url } = event;
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const redirectTo = safeInternalRedirect(
      String(
        form.get("redirectTo") ??
          url.searchParams.get("redirectTo") ??
          "/dashboard",
      ),
    );
    const result = await signInEmail(event, email, password);
    if (!result.ok) return fail(400, { message: result.message, email });
    throw redirect(303, redirectTo);
  },
  signUp: async (event) => {
    const { request, url } = event;
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const redirectTo = safeInternalRedirect(
      String(
        form.get("redirectTo") ??
          url.searchParams.get("redirectTo") ??
          "/dashboard",
      ),
    );
    // Neon Auth issues a session on sign-up (email verification is not required
    // for this project), so we can send the user straight into the app.
    const result = await signUpEmail(
      event,
      email,
      password,
      email.split("@")[0],
    );
    if (!result.ok) return fail(400, { message: result.message, email });
    throw redirect(303, redirectTo);
  },
  google: async (event) => {
    const { url } = event;
    const callbackURL = `${url.origin}/auth/callback`;
    const { url: providerUrl, message } = await socialSignInUrl(
      event,
      "google",
      callbackURL,
    );
    if (!providerUrl)
      return fail(400, { message: message ?? "Google OAuth unavailable." });
    throw redirect(303, providerUrl);
  },
  resetPassword: async (event) => {
    const { request, url } = event;
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const result = await requestPasswordReset(
      event,
      email,
      `${url.origin}/auth/update-password`,
    );
    if (!result.ok) return fail(400, { message: result.message, email });
    return { message: "Email de recuperação enviado." };
  },
  signOut: async (event) => {
    await signOut(event);
    throw redirect(303, "/");
  },
};

export async function load({ locals, url }) {
  if (locals.user)
    throw redirect(
      303,
      safeInternalRedirect(url.searchParams.get("redirectTo")),
    );
  return {
    redirectTo: safeInternalRedirect(url.searchParams.get("redirectTo")),
  };
}
