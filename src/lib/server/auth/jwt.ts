import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { runtimeEnv } from "$server/runtime";

// One JWKS set per JWKS URL, cached across requests in the isolate. `jose`'s
// remote set handles its own key rotation/caching internally.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(platform?: App.Platform) {
  const url = runtimeEnv(platform).NEON_AUTH_JWKS_URL;
  if (!url) {
    throw new Error("NEON_AUTH_JWKS_URL must be configured to verify tokens.");
  }
  let jwks = jwksCache.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url));
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
