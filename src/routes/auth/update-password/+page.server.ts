import { fail, redirect, type Actions } from "@sveltejs/kit";
import { resetPassword } from "$server/auth/session";

export async function load({ url }) {
  // The reset link from the recovery email carries the one-time token.
  return { token: url.searchParams.get("token") ?? "" };
}

export const actions: Actions = {
  default: async (event) => {
    const { request, url } = event;
    const form = await request.formData();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const token = String(
      form.get("token") ?? url.searchParams.get("token") ?? "",
    );

    if (!token) {
      return fail(400, {
        message: "Link de recuperação inválido ou expirado.",
      });
    }
    if (password.length < 6) {
      return fail(400, {
        message: "A senha precisa ter pelo menos 6 caracteres.",
      });
    }
    if (password !== confirmPassword) {
      return fail(400, { message: "As senhas não coincidem." });
    }

    const result = await resetPassword(event, password, token);
    if (!result.ok) return fail(400, { message: result.message });

    throw redirect(303, "/auth?message=senha_atualizada");
  },
};
