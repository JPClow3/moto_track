import { describe, expect, it } from "vitest";
import { resolveRuntimeEnv } from "../../src/lib/server/runtime";

describe("runtime bindings", () => {
  it("uses Cloudflare request bindings ahead of local fallbacks", () => {
    const runtime = resolveRuntimeEnv(
      {
        PUBLIC_SUPABASE_URL: "https://bound.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "bound-service-role",
        STRIPE_SECRET_KEY: "bound-stripe-key",
      },
      {
        PUBLIC_SUPABASE_URL: "https://fallback.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "fallback-service-role",
        STRIPE_SECRET_KEY: "fallback-stripe-key",
      },
    );

    expect(runtime.PUBLIC_SUPABASE_URL).toBe("https://bound.supabase.co");
    expect(runtime.SUPABASE_SERVICE_ROLE_KEY).toBe("bound-service-role");
    expect(runtime.STRIPE_SECRET_KEY).toBe("bound-stripe-key");
  });
});
