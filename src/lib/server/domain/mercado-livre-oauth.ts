/**
 * Documented Mercado Livre OAuth transport. This module does not persist grants,
 * start a checkout or quote prices. Routes must bind pending authorizations to
 * the signed-in owner and atomically consume them before exchanging a code.
 * Refresh tokens rotate once: callers must serialize refreshes and persist the
 * returned pair together. An indeterminate result must not be blindly retried.
 *
 * https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao
 */
export const MERCADO_LIVRE_AUTHORIZATION_URL =
  "https://auth.mercadolivre.com.br/authorization";
export const MERCADO_LIVRE_TOKEN_URL =
  "https://api.mercadolibre.com/oauth/token";
export const MERCADO_LIVRE_AUTHORIZATION_TTL_MS = 10 * 60_000;

export type MercadoLivreOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type MercadoLivrePendingAuthorization = {
  ownerId: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
  expiresAtMs: number;
};

export type MercadoLivreTokenSet = {
  accessToken: string;
  refreshToken: string;
  userId: number;
  expiresAtMs: number;
  scopes: string[];
};

export type MercadoLivreOAuthErrorCode =
  | "configuration-required"
  | "invalid-request"
  | "invalid-state"
  | "reauthorization-required"
  | "access-denied"
  | "rate-limited"
  | "upstream-unavailable"
  | "indeterminate-result";

export class MercadoLivreOAuthError extends Error {
  constructor(
    readonly code: MercadoLivreOAuthErrorCode,
    readonly grantMayBeConsumed = false,
  ) {
    // Never expose a token, client secret, provider error body or callback code.
    super(`Mercado Livre OAuth: ${code}`);
    this.name = "MercadoLivreOAuthError";
  }
}

const TOKEN_MAX_LENGTH = 8192;
const DEFAULT_TIMEOUT_MS = 5000;

function hasControlCharacters(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function opaque(value: unknown, maxLength = TOKEN_MAX_LENGTH): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !/\s/u.test(value) &&
    !hasControlCharacters(value)
  );
}

/** Validate configuration without silently changing the registered callback. */
export function validateMercadoLivreOAuthConfig(
  config: MercadoLivreOAuthConfig,
): MercadoLivreOAuthConfig {
  if (
    !opaque(config?.clientId, 100) ||
    !/^[A-Za-z0-9_-]+$/.test(config.clientId) ||
    !opaque(config.clientSecret) ||
    !opaque(config.redirectUri, 2048)
  ) {
    throw new MercadoLivreOAuthError("configuration-required");
  }
  let callback: URL;
  try {
    callback = new URL(config.redirectUri);
  } catch {
    throw new MercadoLivreOAuthError("configuration-required");
  }
  if (
    callback.protocol !== "https:" ||
    callback.username ||
    callback.password ||
    callback.hash ||
    config.redirectUri !== config.redirectUri.trim()
  ) {
    throw new MercadoLivreOAuthError("configuration-required");
  }
  return { ...config };
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomOpaque() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function validVerifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

export async function mercadoLivreCodeChallenge(codeVerifier: string) {
  if (!validVerifier(codeVerifier)) {
    throw new MercadoLivreOAuthError("invalid-request");
  }
  return base64Url(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(codeVerifier),
      ),
    ),
  );
}

/** Return only authorizationUrl to the browser; pending is private server data. */
export async function beginMercadoLivreAuthorization(
  input: MercadoLivreOAuthConfig,
  ownerId: string,
  nowMs = Date.now(),
) {
  const config = validateMercadoLivreOAuthConfig(input);
  if (
    !opaque(ownerId, 128) ||
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0 ||
    !Number.isSafeInteger(nowMs + MERCADO_LIVRE_AUTHORIZATION_TTL_MS)
  ) {
    throw new MercadoLivreOAuthError("invalid-request");
  }
  const pending: MercadoLivrePendingAuthorization = {
    ownerId,
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state: randomOpaque(),
    codeVerifier: randomOpaque(),
    expiresAtMs: nowMs + MERCADO_LIVRE_AUTHORIZATION_TTL_MS,
  };
  const authorization = new URL(MERCADO_LIVRE_AUTHORIZATION_URL);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("client_id", config.clientId);
  authorization.searchParams.set("redirect_uri", config.redirectUri);
  authorization.searchParams.set("state", pending.state);
  authorization.searchParams.set("code_challenge_method", "S256");
  authorization.searchParams.set(
    "code_challenge",
    await mercadoLivreCodeChallenge(pending.codeVerifier),
  );
  return { authorizationUrl: authorization.toString(), pending };
}

function equalState(expected: string, actual: string) {
  if (expected.length !== actual.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }
  return difference === 0;
}

type RequestOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  nowMs?: number;
};

function validateOptions(options: RequestOptions) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const nowMs = options.nowMs ?? Date.now();
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 30000 ||
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0 ||
    !Number.isSafeInteger(nowMs + 86400 * 1000)
  ) {
    throw new MercadoLivreOAuthError("invalid-request");
  }
  return { timeoutMs, nowMs };
}

function statusError(status: number, data: unknown) {
  const error =
    data && typeof data === "object" && "error" in data
      ? (data as { error: unknown }).error
      : undefined;
  if (status >= 500) {
    return new MercadoLivreOAuthError("indeterminate-result", true);
  }
  if (status === 429) return new MercadoLivreOAuthError("rate-limited");
  if (error === "invalid_grant") {
    return new MercadoLivreOAuthError("reauthorization-required");
  }
  if (error === "invalid_client") {
    return new MercadoLivreOAuthError("configuration-required");
  }
  if (status === 401 || status === 403) {
    return new MercadoLivreOAuthError("access-denied");
  }
  return new MercadoLivreOAuthError("upstream-unavailable");
}

async function requestToken(
  form: URLSearchParams,
  options: RequestOptions,
  expectedUserId?: number,
): Promise<MercadoLivreTokenSet> {
  const { timeoutMs, nowMs } = validateOptions(options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetchImpl ?? fetch)(
      MERCADO_LIVRE_TOKEN_URL,
      {
        method: "POST",
        redirect: "error",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: controller.signal,
      },
    );
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (!response.ok) throw statusError(response.status, undefined);
      throw new MercadoLivreOAuthError("indeterminate-result", true);
    }
    if (!response.ok) throw statusError(response.status, data);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new MercadoLivreOAuthError("indeterminate-result", true);
    }
    const result = data as Record<string, unknown>;
    if (
      !opaque(result.access_token) ||
      !opaque(result.refresh_token) ||
      typeof result.user_id !== "number" ||
      !Number.isSafeInteger(result.user_id) ||
      result.user_id <= 0 ||
      (expectedUserId !== undefined && result.user_id !== expectedUserId) ||
      typeof result.expires_in !== "number" ||
      !Number.isSafeInteger(result.expires_in) ||
      result.expires_in <= 0 ||
      result.expires_in > 86400 ||
      typeof result.token_type !== "string" ||
      result.token_type.toLowerCase() !== "bearer" ||
      (result.scope !== undefined &&
        (typeof result.scope !== "string" ||
          result.scope.length > 1024 ||
          hasControlCharacters(result.scope)))
    ) {
      // A success response may already have consumed/rotated the grant even
      // when its body cannot be safely persisted. Never report this as a retry.
      throw new MercadoLivreOAuthError("indeterminate-result", true);
    }
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      userId: result.user_id,
      expiresAtMs: nowMs + result.expires_in * 1000,
      scopes:
        typeof result.scope === "string"
          ? [...new Set(result.scope.split(/ +/).filter(Boolean))]
          : [],
    };
  } catch (error) {
    if (error instanceof MercadoLivreOAuthError) throw error;
    throw new MercadoLivreOAuthError("indeterminate-result", true);
  } finally {
    clearTimeout(timer);
  }
}

/** Caller must atomically consume the matching owner-bound pending row first. */
export async function exchangeMercadoLivreAuthorization({
  config: input,
  pending,
  ownerId,
  returnedState,
  code,
  ...options
}: {
  config: MercadoLivreOAuthConfig;
  pending: MercadoLivrePendingAuthorization;
  ownerId: string;
  returnedState: unknown;
  code: unknown;
} & RequestOptions) {
  const config = validateMercadoLivreOAuthConfig(input);
  const { nowMs } = validateOptions(options);
  if (
    !pending ||
    !opaque(ownerId, 128) ||
    ownerId !== pending.ownerId ||
    pending.clientId !== config.clientId ||
    pending.redirectUri !== config.redirectUri ||
    !validVerifier(pending.codeVerifier) ||
    !opaque(pending.state, 128) ||
    !opaque(returnedState, 128) ||
    !equalState(pending.state, returnedState) ||
    !Number.isSafeInteger(pending.expiresAtMs) ||
    pending.expiresAtMs <= nowMs ||
    pending.expiresAtMs > nowMs + MERCADO_LIVRE_AUTHORIZATION_TTL_MS
  ) {
    throw new MercadoLivreOAuthError("invalid-state");
  }
  if (!opaque(code, 2048)) {
    throw new MercadoLivreOAuthError("invalid-request");
  }
  return requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: pending.codeVerifier,
    }),
    options,
  );
}

/** Exactly one request; the previous refresh token must never be retried blindly. */
export async function refreshMercadoLivreTokens({
  config: input,
  current,
  ...options
}: {
  config: MercadoLivreOAuthConfig;
  current: Pick<MercadoLivreTokenSet, "refreshToken" | "userId">;
} & RequestOptions) {
  const config = validateMercadoLivreOAuthConfig(input);
  if (
    !opaque(current?.refreshToken) ||
    !Number.isSafeInteger(current.userId) ||
    current.userId <= 0
  ) {
    throw new MercadoLivreOAuthError("invalid-request");
  }
  return requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: current.refreshToken,
    }),
    options,
    current.userId,
  );
}
