import { afterEach, describe, expect, it, vi } from "vitest";
import { socialSignInUrl } from "../../src/lib/server/auth/session";
import {
  actions,
  load as loadAuthPage,
} from "../../src/routes/auth/+page.server";
import { GET as oauthCallback } from "../../src/routes/auth/callback/+server";

vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));

describe("social sign-in", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["google", "apple"] as const)(
    "stores Neon’s OAuth challenge before redirecting to %s",
    async (provider) => {
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
        provider,
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
    },
  );

  it("does not start Apple sign-in before its credentials are configured", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await actions.apple({
      url: new URL("https://moto-track.net/auth"),
      request: new Request("https://moto-track.net/auth", { method: "POST" }),
      locals: { locale: "pt-BR" },
    } as never);
    expect(result).toMatchObject({ status: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["google", "apple"] as const)(
    "keeps %s out of the native webview flow",
    async (provider) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const result = await actions[provider]({
        request: new Request("https://moto-track.net/auth", {
          method: "POST",
          headers: { "user-agent": "MotoTrackNative/iOS" },
        }),
        locals: { locale: "pt-BR" },
        platform: { env: { NEON_AUTH_SOCIAL_PROVIDERS: "google,apple" } },
      } as never);
      expect(result).toMatchObject({ status: 403 });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("starts Apple OAuth with safe success and error destinations", async () => {
    const set = vi.fn();
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://appleid.apple.com/auth/authorize" }),
      headers: {
        getSetCookie: () => [
          "__Secure-neon-auth.session_challange=challenge; Path=/; HttpOnly; Secure",
        ],
      },
    });
    vi.stubGlobal("fetch", fetch);
    await expect(
      actions.apple({
        url: new URL("https://moto-track.net/auth"),
        request: new Request("https://moto-track.net/auth", {
          method: "POST",
          body: new URLSearchParams({ redirectTo: "https://evil.example" }),
        }),
        locals: { locale: "pt-BR" },
        platform: {
          env: {
            PUBLIC_NEON_AUTH_URL: "https://auth.example/neondb/auth",
            NEON_AUTH_SOCIAL_PROVIDERS: "google,apple",
          },
        },
        cookies: { set },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "https://appleid.apple.com/auth/authorize",
    });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      provider: "apple",
      callbackURL: "https://moto-track.net/auth/callback?next=%2Fdashboard",
      errorCallbackURL:
        "https://moto-track.net/auth?redirectTo=%2Fdashboard&error=oauth_callback_failed",
    });
  });

  it("returns Apple-specific feedback when Neon cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await socialSignInUrl(
      {
        url: new URL("https://moto-track.net/auth"),
        platform: {
          env: { PUBLIC_NEON_AUTH_URL: "https://auth.example/neondb/auth" },
        },
        locals: { locale: "pt-BR" },
      } as never,
      "apple",
      "https://moto-track.net/auth/callback",
    );
    expect(result).toMatchObject({
      url: null,
      message: expect.stringContaining("Apple"),
    });
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

  it("returns a failed OAuth callback to sign-in with recoverable feedback and the intended destination", async () => {
    await expect(
      oauthCallback({
        url: new URL(
          "https://moto-track.net/auth/callback?next=%2Fbilling%2Fcheckout",
        ),
        cookies: { get: vi.fn() },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location:
        "/auth?redirectTo=%2Fbilling%2Fcheckout&error=oauth_callback_failed",
    });

    const data = await loadAuthPage({
      locals: { user: null },
      url: new URL(
        "https://moto-track.net/auth?redirectTo=%2Fbilling%2Fcheckout&error=oauth_callback_failed",
      ),
    } as never);

    expect(data).toMatchObject({
      redirectTo: "/billing/checkout",
      errorMessage: expect.stringContaining("Tente novamente"),
    });
  });

  it("does not expose an external destination through a failed OAuth callback", async () => {
    await expect(
      oauthCallback({
        url: new URL(
          "https://moto-track.net/auth/callback?next=https%3A%2F%2Fevil.example",
        ),
        cookies: { get: vi.fn() },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/auth?redirectTo=%2Fdashboard&error=oauth_callback_failed",
    });
  });

  it("recovers when the OAuth session exchange is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(
      oauthCallback({
        url: new URL(
          "https://moto-track.net/auth/callback?neon_auth_session_verifier=verifier-value&next=%2Fgarage",
        ),
        platform: {
          env: {
            PUBLIC_NEON_AUTH_URL: "https://auth.example/neondb/auth",
          },
        },
        cookies: { get: vi.fn().mockReturnValue("challenge-value") },
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/auth?redirectTo=%2Fgarage&error=oauth_callback_failed",
    });
  });
});
