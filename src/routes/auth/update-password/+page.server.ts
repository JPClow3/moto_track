import { fail, redirect, type Actions } from "@sveltejs/kit";

export async function load({ locals, url }) {
  if (!locals.user) {
    throw redirect(
      303,
      `/auth?redirectTo=${encodeURIComponent(url.pathname + url.search)}`,
    );
  }
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, "/auth");

    const form = await request.formData();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password.length < 6) {
      return fail(400, {
        message: "A senha precisa ter pelo menos 6 caracteres.",
      });
    }
    if (password !== confirmPassword) {
      return fail(400, { message: "As senhas não coincidem." });
    }

    const { error } = await locals.supabase.auth.updateUser({ password });
    if (error) return fail(400, { message: error.message });

    throw redirect(303, "/dashboard");
  },
};
