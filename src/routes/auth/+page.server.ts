import { fail, redirect, type Actions } from "@sveltejs/kit";
import { safeInternalRedirect } from "$server/auth-redirect";

export const actions: Actions = {
  signIn: async ({ request, locals, url }) => {
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
    const { error } = await locals.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return fail(400, { message: error.message, email });
    throw redirect(303, redirectTo);
  },
  signUp: async ({ request, locals, url }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const redirectTo = `${url.origin}/auth/callback`;
    const { error } = await locals.supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) return fail(400, { message: error.message, email });
    return { message: "Confira seu email para confirmar a conta." };
  },
  google: async ({ locals, url }) => {
    const { data, error } = await locals.supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${url.origin}/auth/callback` },
    });
    if (error || !data.url)
      return fail(400, {
        message: error?.message ?? "Google OAuth unavailable.",
      });
    throw redirect(303, data.url);
  },
  resetPassword: async ({ request, locals, url }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "");
    const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${url.origin}/auth/callback?next=/auth/update-password`,
    });
    if (error) return fail(400, { message: error.message, email });
    return { message: "Email de recuperação enviado." };
  },
  signOut: async ({ locals }) => {
    await locals.supabase.auth.signOut();
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
