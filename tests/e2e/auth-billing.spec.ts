import { expect, test } from "@playwright/test";

/**
 * Authenticated flows need a live Neon Auth project. Without credentials the
 * suite stays green offline by skipping, while preview/CI with secrets can
 * exercise the garage → billing surface.
 */
const hasAuthEnv = Boolean(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD,
);

test.describe("authenticated garage and billing", () => {
  test.skip(!hasAuthEnv, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run.");

  test("signs in and reaches garage + conta", async ({ page }) => {
    await page.goto("/auth");
    await page.locator('input[name="email"]').fill(process.env.E2E_USER_EMAIL!);
    await page
      .locator('input[name="password"]')
      .fill(process.env.E2E_USER_PASSWORD!);
    await page.locator('button[type="submit"]').first().click();

    await page.waitForURL(/\/(dashboard|garage|onboarding)/);
    await page.goto("/garage");
    await expect(page.getByRole("heading").first()).toBeVisible();

    await page.goto("/billing/conta");
    await expect(
      page.getByRole("heading", { name: /Conta|Account/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /export|exportação/i }),
    ).toBeVisible();
  });
});

test("billing portal redirects unauthenticated users to sign-in", async ({
  page,
}) => {
  await page.goto("/billing/portal");
  await expect(page).toHaveURL(/\/auth\?redirectTo=/);
});
