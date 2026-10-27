export const SESSION_CACHE_COOKIE = "mt_session_cache";
/**
 * Same default as Better Auth `session.cookieCache.maxAge`. Revoked sessions
 * can linger until this window ends, which is the tradeoff that library
 * documents for skipping a database read on every `getSession`.
 */
export const SESSION_CACHE_MAX_AGE_SECONDS = 5 * 60;

type CachedSession = {
  userId: string;
  email: string | null;
  expiresAt?: string;
  cachedAt: number;
};

type ResolvedSession = {
  session: { userId: string; expiresAt?: string };
  user: { id: string; email: string | null };
};

type MemoryEntry = { freshUntil: number; value: ResolvedSession };

const MEMORY_CACHE_LIMIT = 200;
const memoryCache = new Map<string, MemoryEntry>();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded =
    value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmac(token: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

function signaturesMatch(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function cacheStillValid(cached: CachedSession, now: number): boolean {
  if (!cached.userId || !Number.isFinite(cached.cachedAt)) return false;
  if (now - cached.cachedAt >= SESSION_CACHE_MAX_AGE_SECONDS * 1000)
    return false;
  if (cached.expiresAt) {
    const expiresAt = Date.parse(cached.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt <= now) return false;
  }
  return true;
}

function toResolved(cached: CachedSession): ResolvedSession {
  return {
    session: { userId: cached.userId, expiresAt: cached.expiresAt },
    user: { id: cached.userId, email: cached.email },
  };
}

async function cacheKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

function rememberInMemory(key: string, cached: CachedSession) {
  memoryCache.delete(key);
  memoryCache.set(key, {
    freshUntil: cached.cachedAt + SESSION_CACHE_MAX_AGE_SECONDS * 1000,
    value: toResolved(cached),
  });
  while (memoryCache.size > MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
}

async function verifyCookie(
  token: string,
  raw: string,
  now: number,
): Promise<CachedSession | null> {
  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;
  const encoded = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = await hmac(token, encoded);
  if (!signaturesMatch(signature, expected)) return null;
  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encoded)),
    ) as Partial<CachedSession>;
    const cached: CachedSession = {
      userId: typeof parsed.userId === "string" ? parsed.userId : "",
      email: typeof parsed.email === "string" ? parsed.email : null,
      expiresAt:
        typeof parsed.expiresAt === "string" ? parsed.expiresAt : undefined,
      cachedAt:
        typeof parsed.cachedAt === "number" ? parsed.cachedAt : Number.NaN,
    };
    if (!cacheStillValid(cached, now)) return null;
    return cached;
  } catch {
    return null;
  }
}

/**
 * Cookie cache first (survives a new isolate), then the isolate memory cache.
 * Both are bound to the session token: a forged user id does not verify.
 */
export async function readCachedSession(
  token: string,
  cookieValue: string | undefined,
  now = Date.now(),
): Promise<ResolvedSession | null> {
  if (cookieValue) {
    const cached = await verifyCookie(token, cookieValue, now);
    if (cached) return toResolved(cached);
  }
  const hit = memoryCache.get(await cacheKey(token));
  if (hit && hit.freshUntil > now) return hit.value;
  return null;
}

/** Persist a freshly loaded session. Returns the signed cookie value. */
export async function rememberSession(
  token: string,
  value: ResolvedSession,
  now = Date.now(),
): Promise<string> {
  const cached: CachedSession = {
    userId: value.user.id,
    email: value.user.email,
    expiresAt: value.session.expiresAt,
    cachedAt: now,
  };
  const encoded = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify(cached)),
  );
  const signed = `${encoded}.${await hmac(token, encoded)}`;
  rememberInMemory(await cacheKey(token), cached);
  return signed;
}

export async function forgetCachedSession(token: string): Promise<void> {
  memoryCache.delete(await cacheKey(token));
}
