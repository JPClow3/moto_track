import { fail, redirect, type Actions } from "@sveltejs/kit";
import { resetPassword } from "$server/auth/session";
import { createTranslator } from "$lib/i18n";

export async function load({ url }) {
  // The reset link from the recovery email carries the one-time token.
  return { token: url.searchParams.get("token") ?? "" };
}

export const actions: Actions = {
  default: async (event) => {
    const t = createTranslator(event.locals.locale);
    const { request, url } = event;
    const form = await request.formData();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const token = String(
      form.get("token") ?? url.searchParams.get("token") ?? "",
    );

    if (!token) {
      return fail(400, {
        message: t("auth.invalidReset"),
      });
    }
    if (password.length < 6) {
      return fail(400, {
        message: t("auth.passwordTooShort"),
      });
    }
    if (password !== confirmPassword) {
      return fail(400, { message: t("auth.passwordMismatch") });
    }

    const result = await resetPassword(event, password, token);
    if (!result.ok) return fail(400, { message: result.message });

    throw redirect(303, "/auth?message=senha_atualizada");
  },
};
