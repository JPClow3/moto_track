import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";

const authStatePath = "test-results/.auth/user.json";
const hasAuthEnv = Boolean(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD,
);

test("authenticate the shared CI account once", async ({ page }) => {
  test.skip(!hasAuthEnv, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run.");

  await page.goto("/auth");
  await page.locator("#email").fill(process.env.E2E_USER_EMAIL!);
  await page.locator("#password").fill(process.env.E2E_USER_PASSWORD!);
  await page.locator('button[type="submit"]').first().click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /demo|demonstração/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  }

  mkdirSync(dirname(authStatePath), { recursive: true });
  await page.context().storageState({ path: authStatePath });
});
