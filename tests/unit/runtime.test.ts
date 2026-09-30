import { describe, expect, it } from "vitest";
import { resolveRuntimeEnv } from "../../src/lib/server/runtime";

describe("runtime bindings", () => {
  it("uses Cloudflare request bindings ahead of local fallbacks", () => {
    const runtime = resolveRuntimeEnv(
      {
        DATABASE_URL: "postgres://bound.example/db",
        PUBLIC_NEON_AUTH_URL: "https://bound.neonauth.example",
        NEON_AUTH_JWKS_URL:
          "https://bound.neonauth.example/.well-known/jwks.json",
        DODO_PAYMENTS_API_KEY: "bound-dodo-key",
        DODO_PAYMENTS_ENVIRONMENT: "test_mode",
      },
      {
        DATABASE_URL: "postgres://fallback.example/db",
        PUBLIC_NEON_AUTH_URL: "https://fallback.neonauth.example",
        NEON_AUTH_JWKS_URL:
          "https://fallback.neonauth.example/.well-known/jwks.json",
        DODO_PAYMENTS_API_KEY: "fallback-dodo-key",
        DODO_PAYMENTS_ENVIRONMENT: "live_mode",
      },
    );

    expect(runtime.DATABASE_URL).toBe("postgres://bound.example/db");
    expect(runtime.PUBLIC_NEON_AUTH_URL).toBe("https://bound.neonauth.example");
    expect(runtime.NEON_AUTH_JWKS_URL).toBe(
      "https://bound.neonauth.example/.well-known/jwks.json",
    );
    expect(runtime.DODO_PAYMENTS_API_KEY).toBe("bound-dodo-key");
    expect(runtime.DODO_PAYMENTS_ENVIRONMENT).toBe("test_mode");
  });

  it("falls back to the local source when no binding is provided", () => {
    const runtime = resolveRuntimeEnv(undefined, {
      DATABASE_URL: "postgres://fallback.example/db",
      PUBLIC_NEON_AUTH_URL: "https://fallback.neonauth.example",
      NEON_AUTH_JWKS_URL:
        "https://fallback.neonauth.example/.well-known/jwks.json",
    });

    expect(runtime.DATABASE_URL).toBe("postgres://fallback.example/db");
    expect(runtime.PUBLIC_NEON_AUTH_URL).toBe(
      "https://fallback.neonauth.example",
    );
    expect(runtime.NEON_AUTH_JWKS_URL).toBe(
      "https://fallback.neonauth.example/.well-known/jwks.json",
    );
  });

  it("never invents a billing environment or accepts an invalid one", () => {
    expect(resolveRuntimeEnv({}).DODO_PAYMENTS_ENVIRONMENT).toBeUndefined();
    expect(
      resolveRuntimeEnv(
        { DODO_PAYMENTS_ENVIRONMENT: "production" },
        { DODO_PAYMENTS_ENVIRONMENT: "live_mode" },
      ).DODO_PAYMENTS_ENVIRONMENT,
    ).toBeUndefined();
  });
});
