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
        STRIPE_SECRET_KEY: "bound-stripe-key",
      },
      {
        DATABASE_URL: "postgres://fallback.example/db",
        PUBLIC_NEON_AUTH_URL: "https://fallback.neonauth.example",
        NEON_AUTH_JWKS_URL:
          "https://fallback.neonauth.example/.well-known/jwks.json",
        STRIPE_SECRET_KEY: "fallback-stripe-key",
      },
    );

    expect(runtime.DATABASE_URL).toBe("postgres://bound.example/db");
    expect(runtime.PUBLIC_NEON_AUTH_URL).toBe("https://bound.neonauth.example");
    expect(runtime.NEON_AUTH_JWKS_URL).toBe(
      "https://bound.neonauth.example/.well-known/jwks.json",
    );
    expect(runtime.STRIPE_SECRET_KEY).toBe("bound-stripe-key");
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
});
