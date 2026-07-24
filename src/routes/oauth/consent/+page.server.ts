import { error, redirect, type Actions } from "@sveltejs/kit";

// NOTE(oauth-provider): This screen implemented Supabase Auth's OAuth *provider*
// flow (`supabase.auth.oauth.getAuthorizationDetails/approve/deny`), letting the
// app authorize third-party OAuth clients. Neon Auth (Better Auth) exposes an
// equivalent only through its `oidcProvider` plugin, which is not enabled on
// this project. Until that plugin is configured, the flow cannot be honored, so
// the endpoint fails closed instead of silently approving anything.
const UNAVAILABLE =
  "Autorização OAuth de terceiros está temporariamente indisponível.";

export async function load({ locals, url }) {
  if (!locals.user) {
    throw redirect(
      303,
      `/auth?redirectTo=${encodeURIComponent(url.pathname + url.search)}`,
    );
  }
  throw error(503, UNAVAILABLE);
}

export const actions: Actions = {
  approve: async () => {
    throw error(503, UNAVAILABLE);
  },
  deny: async () => {
    throw error(503, UNAVAILABLE);
  },
};
