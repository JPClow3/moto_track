import { afterEach, describe, expect, it, vi } from "vitest";
import { socialSignInUrl } from "../../src/lib/server/auth/session";
import { GET as oauthCallback } from "../../src/routes/auth/callback/+server";

describe("social sign-in", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores Neon’s OAuth challenge on the app domain before redirecting", async () => {
    const set = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          url: "https://accounts.google.com/o/oauth2/auth",
        }),
        headers: {
          getSetCookie: () => [
            "__Secure-neon-auth.session_challange=challenge-value; Path=/; HttpOnly; Secure",
          ],
        },
      }),
    );

    const result = await socialSignInUrl(
      {
        url: new URL("https://moto-track.net/auth"),
        platform: {
          env: {
            PUBLIC_NEON_AUTH_URL: "https://auth.example/neondb/auth",
          },
        },
        cookies: { set },
      } as never,
      "google",
      "https://moto-track.net/auth/callback",
    );

    expect(result.url).toBe("https://accounts.google.com/o/oauth2/auth");
    expect(set).toHaveBeenCalledWith(
      "mt_oauth_challenge",
      "challenge-value",
      expect.objectContaining({
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      }),
    );
  });

  it("exchanges the verifier for an app session at the OAuth callback", async () => {
    const set = vi.fn();
    const get = vi.fn().mockReturnValue("challenge-value");
    const del = vi.fn();
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => [
          "__Secure-neon-auth.session_token=session-value; Path=/; HttpOnly; Secure",
        ],
      },
    });
    vi.stubGlobal("fetch", fetch);

    await expect(
      oauthCallback({
        url: new URL(
          "https://moto-track.net/auth/callback?neon_auth_session_verifier=verifier-value",
        ),
        platform: {
          env: {
            PUBLIC_NEON_AUTH_URL: "https://auth.example/neondb/auth",
          },
        },
        cookies: { get, set, delete: del },
      } as never),
    ).rejects.toMatchObject({ status: 303, location: "/dashboard" });

    expect(fetch).toHaveBeenCalledWith(
      "https://auth.example/neondb/auth/get-session?neon_auth_session_verifier=verifier-value",
      expect.objectContaining({
        headers: expect.objectContaining({
          cookie: "__Secure-neon-auth.session_challange=challenge-value",
          origin: "https://moto-track.net",
        }),
      }),
    );
    expect(set).toHaveBeenCalledWith(
      "mt_session",
      "session-value",
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
    expect(del).toHaveBeenCalledWith("mt_oauth_challenge", { path: "/" });
  });
});
