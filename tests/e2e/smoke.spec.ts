import { expect, test } from "@playwright/test";

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /toda a vida da/i }),
  ).toBeVisible();
});

test("pricing lets a visitor select an annual Pro checkout", async ({
  page,
}) => {
  await page.goto("/precos");

  await expect(page.getByRole("radio", { name: /anual/i })).toBeVisible();
  await page.getByRole("radio", { name: /anual/i }).check();
  await expect(page.getByRole("radio", { name: /anual/i })).toBeChecked();
  await expect(page.locator('form[action="/billing/checkout"]')).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /continuar para checkout/i }),
  ).toBeVisible();
});
