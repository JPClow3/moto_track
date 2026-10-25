import type { RequestEvent } from "@sveltejs/kit";
import { runtimeEnv } from "$server/runtime";
import {
  forgetCachedSession,
  readCachedSession,
  rememberSession,
} from "$server/auth/session-cache";
import { createTranslator, DEFAULT_LOCALE, type MessageKey } from "$lib/i18n";

// Neon Auth (Managed Better Auth) is hosted on a *different* domain than this
// app, so we can't let its `__Secure-` session cookie ride back to the browser
// directly (it would be scoped to the neonauth host, and `__Secure-` can't even
// be set over http://localhost in dev). Instead the app acts as a proxy: it
// calls the Better Auth REST endpoints server-side, captures the upstream
// signed session-token value, and stores it in its OWN first-party cookie.
const APP_SESSION_COOKIE = "mt_session";
const APP_OAUTH_CHALLENGE_COOKIE = "mt_oauth_challenge";
// The cookie name Better Auth expects back on its endpoints.
const UPSTREAM_COOKIE = "__Secure-neon-auth.session_token";
const UPSTREAM_OAUTH_CHALLENGE_COOKIE = "__Secure-neon-auth.session_challange";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, matching the upstream Max-Age.
const OAUTH_CHALLENGE_MAX_AGE_SECONDS = 10 * 60;

export type AuthUser = { id: string; email: string | null };
export type AuthSession = { userId: string; expiresAt?: string };

function authBase(platform?: App.Platform) {
  const base = runtimeEnv(platform).PUBLIC_NEON_AUTH_URL;
  if (!base) {
    throw new Error("PUBLIC_NEON_AUTH_URL must be configured for Neon Auth.");
  }
  return base.replace(/\/$/, "");
}

// Better Auth rejects requests without an Origin it trusts (CSRF guard). The
// app's own origin must be listed as a trusted origin in the Neon Auth project
// (localhost is allowed automatically).
function appOrigin(event: RequestEvent) {
  return event.url.origin;
}

function setCookieValues(res: Response): string[] {
  const anyHeaders = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

// Pull the signed session-token value out of the upstream Set-Cookie list.
function extractUpstreamToken(res: Response): string | null {
  return extractUpstreamCookie(res, UPSTREAM_COOKIE);
}

function extractUpstreamCookie(res: Response, name: string): string | null {
  for (const cookie of setCookieValues(res)) {
    const [pair] = cookie.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === name) {
      return decodeURIComponent(pair.slice(eq + 1).trim());
    }
  }
  return null;
}

function storeSession(event: RequestEvent, token: string) {
  event.cookies.set(APP_SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: event.url.protocol === "https:",
    maxAge: MAX_AGE_SECONDS,
  });
}

function storeOAuthChallenge(event: RequestEvent, challenge: string) {
  event.cookies.set(APP_OAUTH_CHALLENGE_COOKIE, challenge, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: event.url.protocol === "https:",
    maxAge: OAUTH_CHALLENGE_MAX_AGE_SECONDS,
  });
}

export function clearSession(event: RequestEvent) {
  event.cookies.delete(APP_SESSION_COOKIE, { path: "/" });
}

async function call(
  event: RequestEvent,
  path: string,
  init: {
    method?: string;
    body?: unknown;
    token?: string | null;
    oauthChallenge?: string | null;
  } = {},
) {
  const headers: Record<string, string> = { origin: appOrigin(event) };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.oauthChallenge) {
    headers["cookie"] =
      `${UPSTREAM_OAUTH_CHALLENGE_COOKIE}=${init.oauthChallenge}`;
  } else if (init.token) {
    headers["cookie"] = `${UPSTREAM_COOKIE}=${init.token}`;
  }
  const res = await fetch(`${authBase(event.platform)}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  return res;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

type SessionLoad = {
  session: AuthSession | null;
  user: AuthUser | null;
};

const inflightSessionLoads = new Map<string, Promise<SessionLoad>>();

function sessionFromPayload(data: Record<string, unknown>): {
  session: AuthSession;
  user: AuthUser;
} | null {
  const session = data.session as Record<string, unknown> | null | undefined;
  const user = data.user as Record<string, unknown> | null | undefined;
  if (!session || !user) return null;
  const id = (user.id ?? session.userId) as string | undefined;
  if (!id) return null;
  const expiresAt = session.expiresAt;
  return {
    session: {
      userId: id,
      expiresAt: typeof expiresAt === "string" ? expiresAt : undefined,
    },
    user: { id, email: (user.email as string | null) ?? null },
  };
}

async function loadSession(
  event: RequestEvent,
  token: string,
): Promise<SessionLoad> {
  const res = await call(event, "/get-session", { token });
  if (!res.ok) return { session: null, user: null };
  const resolved = sessionFromPayload(await readJson(res));
  if (!resolved) return { session: null, user: null };
  try {
    await rememberSession(token, resolved);
  } catch {
    // A cache write must not fail an otherwise valid session.
  }
  return resolved;
}

/** Resolve the current user from the app's session cookie, or null. */
export async function resolveSession(
  event: RequestEvent,
): Promise<{ session: AuthSession | null; user: AuthUser | null }> {
  const token = event.cookies.get(APP_SESSION_COOKIE);
  if (!token) return { session: null, user: null };

  const cached = await readCachedSession(token);
  if (cached) return cached;

  // Parallel requests in one isolate share one Neon Auth round trip.
  // Each get-session reads neon_auth.session and neon_auth.jwks.
  const existing = inflightSessionLoads.get(token);
  if (existing) return existing;
  const pending = loadSession(event, token).finally(() => {
    inflightSessionLoads.delete(token);
  });
  inflightSessionLoads.set(token, pending);
  const loaded = await pending;
  return { session: loaded.session, user: loaded.user };
}

type Result = { ok: boolean; message?: string };

function authError(
  event: RequestEvent,
  data: Record<string, unknown>,
  fallback: MessageKey,
) {
  const codes: Record<string, MessageKey> = {
    INVALID_EMAIL_OR_PASSWORD: "auth.invalidCredentials",
    INVALID_PASSWORD: "auth.invalidCredentials",
    USER_NOT_FOUND: "auth.invalidCredentials",
    USER_ALREADY_EXISTS: "auth.accountExists",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "auth.accountExists",
    INVALID_EMAIL: "auth.invalidEmail",
    PASSWORD_TOO_SHORT: "auth.passwordTooShort",
    INVALID_TOKEN: "auth.invalidReset",
  };
  const code = String(data.code ?? "");
  return createTranslator(event.locals?.locale ?? DEFAULT_LOCALE)(
    Object.hasOwn(codes, code) ? codes[code] : fallback,
  );
}

async function authenticate(
  event: RequestEvent,
  path: string,
  body: Record<string, unknown>,
): Promise<Result> {
  const res = await call(event, path, { method: "POST", body });
  if (!res.ok) {
    const data = await readJson(res);
    return { ok: false, message: authError(event, data, "auth.failed") };
  }
  const token = extractUpstreamToken(res);
  if (!token) {
    return { ok: false, message: authError(event, {}, "auth.failed") };
  }
  storeSession(event, token);
  return { ok: true };
}

export function signInEmail(
  event: RequestEvent,
  email: string,
  password: string,
) {
  return authenticate(event, "/sign-in/email", { email, password });
}

export function signUpEmail(
  event: RequestEvent,
  email: string,
  password: string,
  name: string,
) {
  return authenticate(event, "/sign-up/email", { email, password, name });
}

/** Verification is always bound to the signed-in account, never a submitted email. */
export async function requestEmailVerification(
  event: RequestEvent,
): Promise<Result> {
  if (!event.locals.user?.email)
    return {
      ok: false,
      message: authError(event, {}, "auth.verificationSignIn"),
    };
  const response = await call(event, "/email-otp/send-verification-otp", {
    method: "POST",
    token: event.cookies.get(APP_SESSION_COOKIE),
    body: { email: event.locals.user.email, type: "email-verification" },
  });
  return response.ok
    ? { ok: true }
    : {
        ok: false,
        message: authError(event, {}, "auth.verificationSendFailed"),
      };
}

export async function verifyEmailAddress(
  event: RequestEvent,
  code: string,
): Promise<Result> {
  if (!event.locals.user?.email || !/^\d{4,10}$/.test(code))
    return {
      ok: false,
      message: authError(event, {}, "auth.verificationRequired"),
    };
  const response = await call(event, "/email-otp/verify-email", {
    method: "POST",
    token: event.cookies.get(APP_SESSION_COOKIE),
    body: { email: event.locals.user.email, otp: code },
  });
  if (!response.ok)
    return {
      ok: false,
      message: authError(event, {}, "auth.verificationInvalid"),
    };
  const token = extractUpstreamToken(response);
  if (token) storeSession(event, token);
  return { ok: true };
}

export async function completeSocialSignIn(
  event: RequestEvent,
  verifier: string,
): Promise<Result> {
  const challenge = event.cookies.get(APP_OAUTH_CHALLENGE_COOKIE);
  if (!challenge) return { ok: false, message: "OAuth session expired." };

  const res = await call(
    event,
    `/get-session?neon_auth_session_verifier=${encodeURIComponent(verifier)}`,
    { oauthChallenge: challenge },
  );
  if (!res.ok)
    return { ok: false, message: "OAuth session verification failed." };

  const token = extractUpstreamToken(res);
  if (!token) return { ok: false, message: "No session issued." };

  storeSession(event, token);
  event.cookies.delete(APP_OAUTH_CHALLENGE_COOKIE, { path: "/" });
  return { ok: true };
}

export async function signOut(event: RequestEvent) {
  const token = event.cookies.get(APP_SESSION_COOKIE);
  if (token) {
    await forgetCachedSession(token);
    // Best-effort upstream revocation; the local cookie clear is what matters.
    try {
      await call(event, "/sign-out", { method: "POST", body: {}, token });
    } catch {
      // ignore network errors on sign-out
    }
  }
  clearSession(event);
}

/** Start a social (OAuth) sign-in; returns the provider URL to redirect to. */
export async function socialSignInUrl(
  event: RequestEvent,
  provider: string,
  callbackURL: string,
): Promise<{ url: string | null; message?: string }> {
  const res = await call(event, "/sign-in/social", {
    method: "POST",
    body: { provider, callbackURL },
  });
  if (!res.ok) {
    const data = await readJson(res);
    return { url: null, message: authError(event, data, "auth.googleFailed") };
  }
  const challenge = extractUpstreamCookie(res, UPSTREAM_OAUTH_CHALLENGE_COOKIE);
  if (!challenge) {
    return { url: null, message: authError(event, {}, "auth.googleFailed") };
  }
  storeOAuthChallenge(event, challenge);
  const data = await readJson(res);
  return { url: (data.url as string) ?? null };
}

export async function requestPasswordReset(
  event: RequestEvent,
  email: string,
  redirectTo: string,
): Promise<Result> {
  const res = await call(event, "/request-password-reset", {
    method: "POST",
    body: { email, redirectTo },
  });
  if (!res.ok) {
    const data = await readJson(res);
    return {
      ok: false,
      message: authError(event, data, "auth.requestFailed"),
    };
  }
  return { ok: true };
}

export async function resetPassword(
  event: RequestEvent,
  newPassword: string,
  token: string,
): Promise<Result> {
  const res = await call(event, "/reset-password", {
    method: "POST",
    body: { newPassword, token },
  });
  if (!res.ok) {
    const data = await readJson(res);
    return { ok: false, message: authError(event, data, "auth.resetFailed") };
  }
  return { ok: true };
}
