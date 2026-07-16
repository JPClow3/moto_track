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
    reuseExistingServer: false,
  },
});
