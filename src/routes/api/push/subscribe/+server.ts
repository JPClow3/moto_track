import { error, json } from "@sveltejs/kit";
import { runtimeEnv } from "$server/runtime";
import {
  encryptPushField,
  isAllowedPushEndpoint,
  pushEndpointHash,
} from "$server/domain/push-crypto";

async function requestedEndpoint(request: Request) {
  const body = await request.json().catch(() => null);
  return typeof body?.endpoint === "string" ? body.endpoint : "";
}

export async function POST({ request, locals, platform }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  const secret = runtimeEnv(platform).PUSH_ENCRYPTION_KEY;
  if (!endpoint || !p256dh || !auth || !secret)
    throw error(400, "Invalid subscription data.");
  if (!isAllowedPushEndpoint(endpoint)) {
    throw error(400, "Unsupported push endpoint.");
  }
  const endpointHash = await pushEndpointHash(endpoint);
  try {
    await locals.db`
      insert into push_subscriptions ${locals.db({
        owner_id: locals.user.id,
        endpoint_hash: endpointHash,
        endpoint_encrypted: await encryptPushField(endpoint, secret),
        p256dh_encrypted: await encryptPushField(p256dh, secret),
        auth_encrypted: await encryptPushField(auth, secret),
      })}
      on conflict (owner_id, endpoint_hash) do update set
        endpoint_encrypted = excluded.endpoint_encrypted,
        p256dh_encrypted = excluded.p256dh_encrypted,
        auth_encrypted = excluded.auth_encrypted,
        updated_at = now()
    `;
  } catch {
    throw error(400, "Unable to save push subscription.");
  }
  return json({ status: "ok" });
}

export async function DELETE({ request, locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const endpoint = await requestedEndpoint(request);
  if (!endpoint || !isAllowedPushEndpoint(endpoint)) {
    throw error(400, "Invalid subscription endpoint.");
  }

  try {
    await locals.db`
      delete from push_subscriptions
      where owner_id = ${locals.user.id}
        and endpoint_hash = ${await pushEndpointHash(endpoint)}
    `;
  } catch {
    throw error(400, "Unable to remove push subscription.");
  }
  // Idempotent by design: a browser may retry after the server delete
  // succeeded but Subscription.unsubscribe() failed locally.
  return json({ status: "ok" });
}
