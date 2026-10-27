import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSession, signOut } from "../../src/lib/server/auth/session";
import { SESSION_CACHE_COOKIE } from "../../src/lib/server/auth/session-cache";

const TOKEN = "session-token";

function sessionEvent(cookies: Map<string, string>, token = TOKEN) {
  cookies.set("mt_session", token);
  return {
    url: new URL("https://moto-track.net/dashboard"),
    platform: {
      env: { PUBLIC_NEON_AUTH_URL: "https://auth.example/neondb/auth" },
    },
    cookies: {
      get: (name: string) => cookies.get(name),
      set: (name: string, value: string) => {
        cookies.set(name, value);
      },
      delete: (name: string) => {
        cookies.delete(name);
      },
    },
  } as never;
}

function sessionResponse() {
  return {
    ok: true,
    json: async () => ({
      session: {
        userId: "user-1",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      user: { id: "user-1", email: "rider@example.com" },
    }),
    headers: { getSetCookie: () => [] },
  };
}

describe("Neon Auth session cache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reuses a signed cookie cache instead of calling get-session again", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal("fetch", fetchMock);
    const cookies = new Map<string, string>();

    const first = await resolveSession(
      sessionEvent(cookies, "cache-hit-token"),
    );
    const second = await resolveSession(
      sessionEvent(cookies, "cache-hit-token"),
    );

    expect(first.user).toEqual({ id: "user-1", email: "rider@example.com" });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cookies.get(SESSION_CACHE_COOKIE)).toBeTruthy();
  });

  it("refetches after the five-minute Better Auth cookie-cache window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T12:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal("fetch", fetchMock);
    const cookies = new Map<string, string>();

    await resolveSession(sessionEvent(cookies, "cache-expire-token"));
    vi.setSystemTime(new Date("2026-10-27T12:05:01.000Z"));
    await resolveSession(sessionEvent(cookies, "cache-expire-token"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a tampered cache cookie and loads the session from Neon Auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal("fetch", fetchMock);
    const cookies = new Map<string, string>([
      [SESSION_CACHE_COOKIE, "eyJ1c2VySWQiOiJhdHRhY2tlciJ9.not-a-signature"],
    ]);

    const resolved = await resolveSession(
      sessionEvent(cookies, "tampered-cache-token"),
    );

    expect(resolved.user?.id).toBe("user-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("drops the cache on sign-out so the next request calls Neon Auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal("fetch", fetchMock);
    const cookies = new Map<string, string>();
    const event = sessionEvent(cookies, "sign-out-token");

    await resolveSession(event);
    await signOut(event);
    expect(cookies.has(SESSION_CACHE_COOKIE)).toBe(false);
    expect(cookies.has("mt_session")).toBe(false);

    await resolveSession(sessionEvent(cookies, "sign-out-token"));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
