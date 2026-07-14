import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5187",
  },
  webServer: {
    command: "npm run dev -- --port 5187",
    url: "http://127.0.0.1:5187",
    reuseExistingServer: false,
  },
});
