import { describe, expect, it, vi } from "vitest";
import {
  beginMercadoLivreAuthorization,
  exchangeMercadoLivreAuthorization,
  mercadoLivreCodeChallenge,
  MERCADO_LIVRE_AUTHORIZATION_TTL_MS,
  MERCADO_LIVRE_TOKEN_URL,
  refreshMercadoLivreTokens,
  validateMercadoLivreOAuthConfig,
} from "$server/domain/mercado-livre-oauth";

const config = {
  clientId: "123456789",
  clientSecret: "private-client-secret",
  redirectUri: "https://app.example.test/integrations/mercado-livre/callback",
};
const nowMs = 1792758000000;
const ownerId = "rider-owner";
const pending = {
  ownerId,
  clientId: config.clientId,
  redirectUri: config.redirectUri,
  state: "owner-bound-random-state",
  codeVerifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
  expiresAtMs: nowMs + MERCADO_LIVRE_AUTHORIZATION_TTL_MS,
};
const successfulResponse = () =>
  new Response(
    JSON.stringify({
      access_token: "fresh-access-token",
      refresh_token: "fresh-rotated-refresh-token",
      user_id: 12345,
      expires_in: 21600,
      token_type: "bearer",
      scope: "read offline_access read",
    }),
    { headers: { "content-type": "application/json" } },
  );

describe("Mercado Livre authorization", () => {
  it("uses the RFC7636 S256 vector without weakening to plain PKCE", async () => {
    expect(await mercadoLivreCodeChallenge(pending.codeVerifier)).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
    await expect(mercadoLivreCodeChallenge("short")).rejects.toMatchObject({
      code: "invalid-request",
    });
  });

  it("generates independent private verifier/state and binds an owner, client and callback", async () => {
    const first = await beginMercadoLivreAuthorization(config, ownerId, nowMs);
    const second = await beginMercadoLivreAuthorization(config, ownerId, nowMs);
    const url = new URL(first.authorizationUrl);
    expect(url.origin).toBe("https://auth.mercadolivre.com.br");
    expect(url.pathname).toBe("/authorization");
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(
      await mercadoLivreCodeChallenge(first.pending.codeVerifier),
    );
    expect(url.searchParams.get("state")).toBe(first.pending.state);
    expect(first.pending.state).toHaveLength(43);
    expect(first.pending.codeVerifier).toHaveLength(43);
    expect(first.pending.state).not.toBe(first.pending.codeVerifier);
    expect(first.pending.state).not.toBe(second.pending.state);
    expect(first.pending.ownerId).toBe(ownerId);
    expect(first.pending.expiresAtMs).toBe(nowMs + 600000);
    expect(first.authorizationUrl).not.toContain(config.clientSecret);
    expect(first.authorizationUrl).not.toContain(first.pending.codeVerifier);
  });

  it.each([
    "http://app.example.test/callback",
    "https://user:password@app.example.test/callback",
    "https://app.example.test/callback#token",
    " https://app.example.test/callback",
    "https://app.example.test/call\nback",
    "https://app.example.test/call back",
    "not-a-url",
  ])(
    "rejects an unregistered/unsafe callback before any grant request: %s",
    (redirectUri) => {
      expect(() =>
        validateMercadoLivreOAuthConfig({ ...config, redirectUri }),
      ).toThrow("configuration-required");
    },
  );

  it("rejects an overflowing authorization clock before creating a pending grant", async () => {
    await expect(
      beginMercadoLivreAuthorization(config, ownerId, Number.MAX_SAFE_INTEGER),
    ).rejects.toMatchObject({ code: "invalid-request" });
  });

  it("exchanges the code as form data only at the fixed API origin", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(successfulResponse());
    const result = await exchangeMercadoLivreAuthorization({
      config,
      pending,
      ownerId,
      returnedState: pending.state,
      code: "one-time-code",
      fetchImpl,
      nowMs,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe(MERCADO_LIVRE_TOKEN_URL);
    expect(request?.method).toBe("POST");
    expect(request?.redirect).toBe("error");
    const body = new URLSearchParams(String(request?.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toBe(pending.codeVerifier);
    expect(body.get("redirect_uri")).toBe(config.redirectUri);
    expect(body.get("client_secret")).toBe(config.clientSecret);
    expect(result).toEqual({
      accessToken: "fresh-access-token",
      refreshToken: "fresh-rotated-refresh-token",
      userId: 12345,
      expiresAtMs: nowMs + 21600000,
      scopes: ["read", "offline_access"],
    });
  });

  it.each([
    { returnedState: "attacker-state" },
    { ownerId: "another-owner" },
    { pending: { ...pending, expiresAtMs: nowMs } },
    { pending: { ...pending, clientId: "another-app" } },
    {
      pending: {
        ...pending,
        redirectUri: "https://other.example.test/callback",
      },
    },
  ])(
    "does not spend a code for an unmatched/expired pending authorization",
    async (override) => {
      const fetchImpl = vi.fn<typeof fetch>();
      await expect(
        exchangeMercadoLivreAuthorization({
          config,
          pending,
          ownerId,
          returnedState: pending.state,
          code: "one-time-code",
          fetchImpl,
          nowMs,
          ...override,
        }),
      ).rejects.toMatchObject({
        code: "invalid-state",
        grantMayBeConsumed: false,
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});

describe("Mercado Livre rotating token contract", () => {
  const current = { refreshToken: "previous-refresh-token", userId: 12345 };

  it("refreshes once and returns the new pair for atomic persistence", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(successfulResponse());
    const next = await refreshMercadoLivreTokens({
      config,
      current,
      fetchImpl,
      nowMs,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = new URLSearchParams(String(fetchImpl.mock.calls[0][1]?.body));
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe(current.refreshToken);
    expect(body.has("code_verifier")).toBe(false);
    expect(next.refreshToken).not.toBe(current.refreshToken);
  });

  it("reports an ambiguous refresh without retrying or leaking credentials", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new Error(
          `network after ${config.clientSecret} ${current.refreshToken}`,
        ),
      );
    const failure = await refreshMercadoLivreTokens({
      config,
      current,
      fetchImpl,
      nowMs,
    }).catch((error: unknown) => error);
    expect(failure).toMatchObject({
      code: "indeterminate-result",
      grantMayBeConsumed: true,
    });
    expect(String(failure)).not.toContain(config.clientSecret);
    expect(String(failure)).not.toContain(current.refreshToken);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, "invalid_grant", "reauthorization-required", false],
    [400, "invalid_client", "configuration-required", false],
    [403, "forbidden", "access-denied", false],
    [429, "too_many_requests", "rate-limited", false],
    [503, "provider_error", "indeterminate-result", true],
  ])(
    "classifies HTTP %i without exposing provider bodies",
    async (status, error, code, grantMayBeConsumed) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error, error_description: config.clientSecret }),
            { status: Number(status) },
          ),
        );
      await expect(
        refreshMercadoLivreTokens({ config, current, fetchImpl, nowMs }),
      ).rejects.toMatchObject({ code, grantMayBeConsumed });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { user_id: 98765 },
    { expires_in: "21600" },
    { expires_in: 0 },
    { access_token: "" },
    { refresh_token: null },
    { token_type: "basic" },
  ])(
    "does not persist a malformed success or an account switch",
    async (override) => {
      const data = await successfulResponse().json();
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...data, ...override })),
        );
      await expect(
        refreshMercadoLivreTokens({ config, current, fetchImpl, nowMs }),
      ).rejects.toMatchObject({
        code: "indeterminate-result",
        grantMayBeConsumed: true,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it("treats a malformed success body as potentially consumed", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("invalid-json"));
    await expect(
      refreshMercadoLivreTokens({ config, current, fetchImpl, nowMs }),
    ).rejects.toMatchObject({
      code: "indeterminate-result",
      grantMayBeConsumed: true,
    });
  });
});
