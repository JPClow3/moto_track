import { shareTokenHash } from "$server/domain/sale-report-share";

function base64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function createPersonalApiToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = `mt_live_${base64url(bytes)}`;
  return {
    token,
    keyHash: await shareTokenHash(token),
    keyPrefix: token.slice(0, 15),
  };
}
