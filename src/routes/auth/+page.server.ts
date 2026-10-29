import { nativePlatform } from "$lib/domain/distribution";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { safeInternalRedirect } from "$server/auth-redirect";
import { createTranslator } from "$lib/i18n";
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
    if (nativePlatform(event.request.headers?.get("user-agent") ?? null)) {
      return fail(403, {
        message: createTranslator(event.locals.locale)("auth.nativeEmail"),
      });
    }
    const { request, url } = event;
    const form = await request.formData().catch(() => new FormData());
    const redirectTo = safeInternalRedirect(
      String(
        form.get("redirectTo") ??
          url.searchParams.get("redirectTo") ??
          "/dashboard",
      ),
    );
    const callbackURL = `${url.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;
    const { url: providerUrl, message } = await socialSignInUrl(
      event,
      "google",
      callbackURL,
    );
    if (!providerUrl)
      return fail(400, {
        message:
          message ?? createTranslator(event.locals.locale)("auth.googleFailed"),
      });
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
    return { message: createTranslator(event.locals.locale)("auth.resetSent") };
  },
  signOut: async (event) => {
    await signOut(event);
    throw redirect(303, "/");
  },
};

export async function load({ locals, url }) {
  const t = createTranslator(locals.locale);
  if (locals.user)
    throw redirect(
      303,
      safeInternalRedirect(url.searchParams.get("redirectTo")),
    );
  return {
    redirectTo: safeInternalRedirect(url.searchParams.get("redirectTo")),
    errorMessage:
      url.searchParams.get("error") === "oauth_callback_failed"
        ? t("auth.googleFailed")
        : undefined,
    message:
      url.searchParams.get("message") === "senha_atualizada"
        ? t("auth.passwordUpdated")
        : undefined,
  };
}
