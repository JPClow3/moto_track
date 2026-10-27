import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { runtimeEnv } from "$server/runtime";

// One JWKS set per URL, kept for the life of the isolate. Neon Auth's
// `neon_auth.jwks` table is a single row and is sequential-scanned on every
// fetch of the JWKS URL, so refetch only after an hour (jose would otherwise
// reload every 10 minutes) and ignore unknown-key retries for 10 minutes.
const JWKS_CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const JWKS_COOLDOWN_MS = 10 * 60 * 1000;
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(platform?: App.Platform) {
  const url = runtimeEnv(platform).NEON_AUTH_JWKS_URL;
  if (!url) {
    throw new Error("NEON_AUTH_JWKS_URL must be configured to verify tokens.");
  }
  let jwks = jwksCache.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url), {
      cacheMaxAge: JWKS_CACHE_MAX_AGE_MS,
      cooldownDuration: JWKS_COOLDOWN_MS,
    });
    jwksCache.set(url, jwks);
  }
  return jwks;
}

/**
 * Verify a Neon Auth access token (EdDSA JWT) against the project JWKS.
 * Returns the payload (with `sub` = user id) or null when invalid/expired.
 */
export async function verifyAccessToken(
  token: string,
  platform?: App.Platform,
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks(platform));
    return payload;
  } catch {
    return null;
  }
}
