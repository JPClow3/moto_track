import { expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({ dev: true }));
vi.mock("$env/dynamic/public", () => ({
  env: {
    PUBLIC_NEON_AUTH_URL: "https://isolated.example/auth",
    PUBLIC_SITE_URL: "http://localhost:5187",
  },
}));
vi.mock("$env/dynamic/private", () => ({
  env: {
    DATABASE_URL: "postgres://isolated.example/db",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
    MISTRAL_API_KEY: "",
    DODO_PAYMENTS_API_KEY: "",
  },
}));

it("keeps explicit local test settings ahead of Wrangler production vars", async () => {
  const { runtimeEnv } = await import("$server/runtime");
  expect(
    runtimeEnv({
      env: {
        PUBLIC_NEON_AUTH_URL: "https://production.example/auth",
        PUBLIC_SITE_URL: "https://moto-track.net",
        DODO_PAYMENTS_ENVIRONMENT: "live_mode",
      },
    } as App.Platform),
  ).toMatchObject({
    PUBLIC_NEON_AUTH_URL: "https://isolated.example/auth",
    PUBLIC_SITE_URL: "http://localhost:5187",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
  });
});

it("keeps intentionally blank local credentials disabled instead of inheriting production secrets", async () => {
  const { runtimeEnv } = await import("$server/runtime");
  const env = runtimeEnv({
    env: {
      MISTRAL_API_KEY: "production-secret",
      DODO_PAYMENTS_API_KEY: "production-secret",
    },
  } as App.Platform);
  expect(env.MISTRAL_API_KEY).toBeUndefined();
  expect(env.DODO_PAYMENTS_API_KEY).toBeUndefined();
});
