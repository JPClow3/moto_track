import { nativePlatform } from "$lib/domain/distribution";
import { fail, redirect, type Actions, type RequestEvent } from "@sveltejs/kit";
import type { SocialAuthProvider } from "$lib/domain/social-auth";
import { safeInternalRedirect } from "$server/auth-redirect";
import { createTranslator } from "$lib/i18n";
import {
  signInEmail,
  signUpEmail,
  signOut,
  socialSignInUrl,
  requestPasswordReset,
  enabledSocialProviders,
} from "$server/auth/session";

async function startSocialSignIn(
  event: RequestEvent,
  provider: SocialAuthProvider,
) {
  const t = createTranslator(event.locals.locale);
  if (nativePlatform(event.request.headers?.get("user-agent") ?? null)) {
    return fail(403, { message: t("auth.nativeEmail") });
  }
  if (!enabledSocialProviders(event.platform).includes(provider)) {
    return fail(403, { message: t("auth.socialUnavailable") });
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
  const errorCallbackURL = new URL("/auth", url.origin);
  errorCallbackURL.searchParams.set("redirectTo", redirectTo);
  errorCallbackURL.searchParams.set("error", "oauth_callback_failed");
  const { url: providerUrl, message } = await socialSignInUrl(
    event,
    provider,
    callbackURL,
    errorCallbackURL.href,
  );
  if (!providerUrl)
    return fail(400, { message: message ?? t("auth.socialFailed") });
  throw redirect(303, providerUrl);
}

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
  google: (event) => startSocialSignIn(event, "google"),
  apple: (event) => startSocialSignIn(event, "apple"),
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

export async function load({ locals, url, platform, request }: RequestEvent) {
  const t = createTranslator(locals.locale);
  if (locals.user)
    throw redirect(
      303,
      safeInternalRedirect(url.searchParams.get("redirectTo")),
    );
  return {
    socialProviders: nativePlatform(request?.headers.get("user-agent") ?? null)
      ? []
      : enabledSocialProviders(platform),
    redirectTo: safeInternalRedirect(url.searchParams.get("redirectTo")),
    errorMessage:
      url.searchParams.get("error") === "oauth_callback_failed"
        ? t("auth.socialFailed")
        : undefined,
    message:
      url.searchParams.get("message") === "senha_atualizada"
        ? t("auth.passwordUpdated")
        : undefined,
  };
}
