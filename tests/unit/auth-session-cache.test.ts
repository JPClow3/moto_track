import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSession, signOut } from "../../src/lib/server/auth/session";

function sessionEvent(token: string, cacheCookie?: string) {
  return {
    url: new URL("https://moto-track.net/dashboard"),
    platform: {
      env: { PUBLIC_NEON_AUTH_URL: "https://auth.example/neondb/auth" },
    },
    cookies: {
      get: (name: string) =>
        name === "mt_session"
          ? token
          : name === "mt_session_cache"
            ? cacheCookie
            : undefined,
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as never;
}

function sessionResponse(expiresAt = "2099-01-01T00:00:00.000Z") {
  return {
    ok: true,
    json: async () => ({
      session: { userId: "user-1", expiresAt },
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

  it("reuses a session Neon Auth already confirmed in this isolate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal("fetch", fetchMock);

    const first = await resolveSession(sessionEvent("cache-hit-token"));
    const second = await resolveSession(sessionEvent("cache-hit-token"));

    expect(first.user).toEqual({ id: "user-1", email: "rider@example.com" });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches after the five-minute cache window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T12:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal("fetch", fetchMock);

    await resolveSession(sessionEvent("cache-expire-token"));
    vi.setSystemTime(new Date("2026-10-27T12:05:01.000Z"));
    await resolveSession(sessionEvent("cache-expire-token"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not keep a session past its Neon Auth expiry", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T12:00:00.000Z"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sessionResponse("2026-10-27T12:02:00.000Z"))
      .mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    await resolveSession(sessionEvent("session-expiry-token"));
    vi.setSystemTime(new Date("2026-10-27T12:02:00.000Z"));
    const resolved = await resolveSession(sessionEvent("session-expiry-token"));

    expect(resolved).toEqual({ session: null, user: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a client-supplied cache and asks Neon Auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
      headers: { getSetCookie: () => [] },
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = "attacker-chosen-token";
    const payload = Buffer.from(
      JSON.stringify({
        userId: "victim",
        email: "victim@example.com",
        cachedAt: Date.now(),
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toString("base64url");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(token),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = Buffer.from(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
    ).toString("base64url");
    const resolved = await resolveSession(
      sessionEvent(token, `${payload}.${signature}`),
    );

    expect(resolved).toEqual({ session: null, user: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("drops the cache on sign-out so the next request calls Neon Auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal("fetch", fetchMock);
    const deleted: string[] = [];
    const event = {
      url: new URL("https://moto-track.net/dashboard"),
      platform: {
        env: { PUBLIC_NEON_AUTH_URL: "https://auth.example/neondb/auth" },
      },
      cookies: {
        get: (name: string) =>
          name === "mt_session" ? "sign-out-token" : undefined,
        set: vi.fn(),
        delete: (name: string) => {
          deleted.push(name);
        },
      },
    } as never;

    await resolveSession(event);
    await signOut(event);
    await resolveSession(sessionEvent("sign-out-token"));

    expect(deleted).toContain("mt_session");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
