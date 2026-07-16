const encoder = new TextEncoder();

export type WebPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type WebPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function fromBase64Url(value: string) {
  const base64 =
    value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function join(...chunks: Uint8Array[]) {
  const output = new Uint8Array(
    chunks.reduce((size, chunk) => size + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function arrayBuffer(value: Uint8Array) {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

async function hmac(keyBytes: Uint8Array, input: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    arrayBuffer(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, arrayBuffer(input)),
  );
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array) {
  return hmac(salt, ikm);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number) {
  const result = await hmac(prk, join(info, new Uint8Array([1])));
  return result.slice(0, length);
}

function vapidPrivateJwk(config: WebPushConfig) {
  const publicKey = fromBase64Url(config.publicKey);
  const privateKey = config.privateKey.trim().startsWith("{")
    ? JSON.parse(config.privateKey)
    : { d: config.privateKey };
  if (publicKey.length !== 65 || publicKey[0] !== 4)
    throw new Error("PUBLIC_VAPID_KEY must be an uncompressed P-256 key.");
  return {
    ...privateKey,
    kty: "EC",
    crv: "P-256",
    x: base64Url(publicKey.slice(1, 33)),
    y: base64Url(publicKey.slice(33)),
  } as JsonWebKey;
}

async function vapidToken(endpoint: string, config: WebPushConfig) {
  const audience = new URL(endpoint).origin;
  const header = base64Url(
    encoder.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })),
  );
  const payload = base64Url(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: config.subject,
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "jwk",
    vapidPrivateJwk(config),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      encoder.encode(`${header}.${payload}`),
    ),
  );
  return `${header}.${payload}.${base64Url(signature)}`;
}

async function encryptedPayload(
  subscription: WebPushSubscription,
  payload: string,
) {
  const clientPublicBytes = fromBase64Url(subscription.p256dh);
  const clientPublic = await crypto.subtle.importKey(
    "raw",
    clientPublicBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublic },
      serverKeyPair.privateKey,
      256,
    ),
  );
  const serverPublicBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
  );
  const authSecret = fromBase64Url(subscription.auth);
  const ikm = await hkdfExpand(
    await hkdfExtract(authSecret, sharedSecret),
    join(
      encoder.encode("WebPush: info\0"),
      clientPublicBytes,
      serverPublicBytes,
    ),
    32,
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const contentEncryptionKey = await hkdfExpand(
    prk,
    encoder.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdfExpand(
    prk,
    encoder.encode("Content-Encoding: nonce\0"),
    12,
  );
  const key = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const plaintext = join(encoder.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext),
  );
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return join(
    salt,
    recordSize,
    new Uint8Array([serverPublicBytes.length]),
    serverPublicBytes,
    ciphertext,
  );
}

export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: Record<string, string>,
  config: WebPushConfig,
) {
  const token = await vapidToken(subscription.endpoint, config);
  const body = await encryptedPayload(subscription, JSON.stringify(payload));
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token}, k=${config.publicKey}`,
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
    },
    body,
  });
  if (!response.ok) throw new Error(`Web Push failed (${response.status}).`);
}
