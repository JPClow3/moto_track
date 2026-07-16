import { error, fail, redirect, type Actions } from "@sveltejs/kit";

export async function load({ locals, url }) {
  const authorizationId = url.searchParams.get("authorization_id");
  if (!authorizationId) {
    throw error(400, "Parâmetro authorization_id ausente.");
  }

  if (!locals.user) {
    throw redirect(
      303,
      `/auth?redirectTo=${encodeURIComponent(url.pathname + url.search)}`,
    );
  }

  const { data, error: detailsError } =
    await locals.supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (detailsError || !data) {
    throw error(
      400,
      detailsError?.message ?? "Solicitação de autorização inválida.",
    );
  }

  if (!("authorization_id" in data)) {
    throw redirect(303, data.redirect_url);
  }

  return {
    authorizationId,
    client: data.client,
    redirectUri: data.redirect_uri,
    scopes: data.scope ? data.scope.split(" ").filter(Boolean) : [],
  };
}

export const actions: Actions = {
  approve: async ({ request, locals }) => {
    const form = await request.formData();
    const authorizationId = String(form.get("authorization_id") ?? "");
    if (!authorizationId)
      return fail(400, { message: "Solicitação inválida." });

    const { data, error: approveError } =
      await locals.supabase.auth.oauth.approveAuthorization(authorizationId);
    if (approveError || !data)
      return fail(400, {
        message: approveError?.message ?? "Falha ao autorizar.",
      });

    throw redirect(303, data.redirect_url);
  },
  deny: async ({ request, locals }) => {
    const form = await request.formData();
    const authorizationId = String(form.get("authorization_id") ?? "");
    if (!authorizationId)
      return fail(400, { message: "Solicitação inválida." });

    const { data, error: denyError } =
      await locals.supabase.auth.oauth.denyAuthorization(authorizationId);
    if (denyError || !data)
      return fail(400, { message: denyError?.message ?? "Falha ao negar." });

    throw redirect(303, data.redirect_url);
  },
};
