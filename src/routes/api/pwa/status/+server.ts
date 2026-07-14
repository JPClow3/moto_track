import { json } from "@sveltejs/kit";
import { runtimeEnv } from "$server/runtime";

export async function GET({ locals, platform }) {
  return json({
    authenticated: Boolean(locals.user),
    pushPublicKey: runtimeEnv(platform).PUBLIC_VAPID_KEY ?? "",
  });
}
