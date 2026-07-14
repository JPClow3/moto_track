import { json } from "@sveltejs/kit";
import { r as runtimeEnv } from "../../../../../chunks/runtime.js";
async function GET({ locals, platform }) {
  return json({
    authenticated: Boolean(locals.user),
    pushPublicKey: runtimeEnv(platform).PUBLIC_VAPID_KEY ?? ""
  });
}
export {
  GET
};
