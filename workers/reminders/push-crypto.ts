const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const base64 =
    value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function aesKey(secret: string) {
  const keyBytes = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(secret),
  );
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Matches `/api/push/subscribe` so the worker can decrypt stored endpoints. */
export async function encryptPushField(value: string, secret: string) {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value),
  );
  return `${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}

export async function decryptPushField(value: string, secret: string) {
  const [ivPart, dataPart] = value.split(".");
  if (!ivPart || !dataPart) throw new Error("Invalid encrypted push field.");
  const key = await aesKey(secret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(dataPart),
  );
  return decoder.decode(plain);
}
