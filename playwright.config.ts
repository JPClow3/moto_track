import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5187",
    // The app now picks its language from Accept-Language, and Chromium sends
    // en-US by default — which would render these pt-BR assertions in English
    // and fail on a machine-dependent whim. Pin it so the suite asserts one
    // known locale; the locale spec overrides this per-context to test English.
    locale: "pt-BR",
  },
  webServer: {
    command: "npm run dev -- --port 5187",
    url: "http://127.0.0.1:5187",
    // Reuse a locally-running dev server; always start fresh in CI. The app's
    // cold start (svelte-kit sync + Vite dep optimization + Hyperdrive emulation)
    // routinely exceeds Playwright's 60s default, so give it real headroom.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
