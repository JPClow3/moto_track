import { defineConfig } from "@playwright/test";

const hasAuthEnv = Boolean(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD,
);
const externalBaseURL = process.env.E2E_BASE_URL?.replace(/\/$/, "");
const authStatePath = "test-results/.auth/user.json";

export default defineConfig({
  testDir: "tests/e2e",
  // Authenticated specs intentionally share one dedicated CI account. Keep
  // them serial so onboarding and mutable garage data cannot race each other.
  workers: hasAuthEnv ? 1 : undefined,
  use: {
    // Neon Auth allows localhost origins for development. Keep the browser
    // origin on localhost (rather than 127.0.0.1) so authenticated CI uses the
    // same trusted-origin contract without weakening production settings.
    baseURL: externalBaseURL ?? "http://localhost:5187",
    // The app now picks its language from Accept-Language, and Chromium sends
    // en-US by default — which would render these pt-BR assertions in English
    // and fail on a machine-dependent whim. Pin it so the suite asserts one
    // known locale; the locale spec overrides this per-context to test English.
    locale: "pt-BR",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run dev -- --port 5187",
        url: "http://localhost:5187",
        // Reuse a locally-running dev server; always start fresh in CI. The app's
        // cold start (svelte-kit sync + Vite dep optimization + Hyperdrive emulation)
        // routinely exceeds Playwright's 60s default, so give it real headroom.
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "authenticated",
      testMatch: [
        /auth-billing\.spec\.ts/,
        /core-responsive\.spec\.ts/,
        /data-responsive\.spec\.ts/,
        /production-provider-smoke\.spec\.ts/,
      ],
      dependencies: ["auth-setup"],
      use: { storageState: hasAuthEnv ? authStatePath : undefined },
    },
    {
      name: "public",
      testIgnore: [
        /auth\.setup\.ts/,
        /auth-billing\.spec\.ts/,
        /core-responsive\.spec\.ts/,
        /data-responsive\.spec\.ts/,
      ],
    },
  ],
});
