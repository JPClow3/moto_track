import { error, json } from "@sveltejs/kit";
import { runtimeEnv } from "$server/runtime";

function base64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function encrypt(value: string, secret: string) {
  const keyBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
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
  const endpointHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  try {
    await locals.db`
      insert into push_subscriptions ${locals.db({
        owner_id: locals.user.id,
        endpoint_hash: endpointHash,
        endpoint_encrypted: await encrypt(endpoint, secret),
        p256dh_encrypted: await encrypt(p256dh, secret),
        auth_encrypted: await encrypt(auth, secret),
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
