import type { RequestEvent } from "@sveltejs/kit";
import { runtimeEnv } from "$server/runtime";

// Neon Auth (Managed Better Auth) is hosted on a *different* domain than this
// app, so we can't let its `__Secure-` session cookie ride back to the browser
// directly (it would be scoped to the neonauth host, and `__Secure-` can't even
// be set over http://localhost in dev). Instead the app acts as a proxy: it
// calls the Better Auth REST endpoints server-side, captures the upstream
// signed session-token value, and stores it in its OWN first-party cookie.
const APP_SESSION_COOKIE = "mt_session";
// The cookie name Better Auth expects back on its endpoints.
const UPSTREAM_COOKIE = "__Secure-neon-auth.session_token";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, matching the upstream Max-Age.

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
  for (const cookie of setCookieValues(res)) {
    const [pair] = cookie.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === UPSTREAM_COOKIE) {
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

export function clearSession(event: RequestEvent) {
  event.cookies.delete(APP_SESSION_COOKIE, { path: "/" });
}

async function call(
  event: RequestEvent,
  path: string,
  init: { method?: string; body?: unknown; token?: string | null } = {},
) {
  const headers: Record<string, string> = { origin: appOrigin(event) };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.token) headers["cookie"] = `${UPSTREAM_COOKIE}=${init.token}`;
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

/** Resolve the current user from the app's session cookie, or null. */
export async function resolveSession(
  event: RequestEvent,
): Promise<{ session: AuthSession | null; user: AuthUser | null }> {
  const token = event.cookies.get(APP_SESSION_COOKIE);
  if (!token) return { session: null, user: null };

  const res = await call(event, "/get-session", { token });
  if (!res.ok) return { session: null, user: null };
  const data = await readJson(res);
  const session = data.session as Record<string, unknown> | null | undefined;
  const user = data.user as Record<string, unknown> | null | undefined;
  if (!session || !user) return { session: null, user: null };

  const id = (user.id ?? session.userId) as string | undefined;
  if (!id) return { session: null, user: null };
  return {
    session: {
      userId: id,
      expiresAt: session.expiresAt as string | undefined,
    },
    user: { id, email: (user.email as string | null) ?? null },
  };
}

type Result = { ok: boolean; message?: string };

async function authenticate(
  event: RequestEvent,
  path: string,
  body: Record<string, unknown>,
): Promise<Result> {
  const res = await call(event, path, { method: "POST", body });
  if (!res.ok) {
    const data = await readJson(res);
    return { ok: false, message: (data.message as string) ?? "Auth failed." };
  }
  const token = extractUpstreamToken(res);
  if (!token) {
    return { ok: false, message: "No session issued." };
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

export async function signOut(event: RequestEvent) {
  const token = event.cookies.get(APP_SESSION_COOKIE);
  if (token) {
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
    return { url: null, message: (data.message as string) ?? "OAuth failed." };
  }
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
      message: (data.message as string) ?? "Request failed.",
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
    return { ok: false, message: (data.message as string) ?? "Reset failed." };
  }
  return { ok: true };
}
