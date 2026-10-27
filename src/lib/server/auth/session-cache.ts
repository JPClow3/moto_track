/**
 * Same default as Better Auth `session.cookieCache.maxAge`. A revoked session
 * can remain visible to this isolate until the window ends. The cache lives
 * only in server memory and is filled after Neon Auth accepts the token.
 * A client cookie cannot supply the user id: the previous HMAC used the
 * caller-supplied session token as the key, which let anyone mint an identity.
 */
export const SESSION_CACHE_MAX_AGE_SECONDS = 5 * 60;

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

async function cacheKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

function freshUntil(expiresAt: string | undefined, now: number): number {
  const windowEnd = now + SESSION_CACHE_MAX_AGE_SECONDS * 1000;
  if (!expiresAt) return windowEnd;
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(expires)) return windowEnd;
  return Math.min(windowEnd, expires);
}

function sessionStillCurrent(value: ResolvedSession, now: number): boolean {
  const expiresAt = value.session.expiresAt;
  if (!expiresAt) return true;
  const expires = Date.parse(expiresAt);
  return !Number.isFinite(expires) || expires > now;
}

/** Return a session previously loaded from Neon Auth in this isolate. */
export async function readCachedSession(
  token: string,
  now = Date.now(),
): Promise<ResolvedSession | null> {
  const key = await cacheKey(token);
  const hit = memoryCache.get(key);
  if (!hit || hit.freshUntil <= now || !sessionStillCurrent(hit.value, now)) {
    if (hit) memoryCache.delete(key);
    return null;
  }
  return hit.value;
}

/** Remember a session Neon Auth just confirmed. Expired sessions are not stored. */
export async function rememberSession(
  token: string,
  value: ResolvedSession,
  now = Date.now(),
): Promise<void> {
  const until = freshUntil(value.session.expiresAt, now);
  if (until <= now) return;
  const key = await cacheKey(token);
  memoryCache.delete(key);
  memoryCache.set(key, { freshUntil: until, value });
  while (memoryCache.size > MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
}

export async function forgetCachedSession(token: string): Promise<void> {
  memoryCache.delete(await cacheKey(token));
}
