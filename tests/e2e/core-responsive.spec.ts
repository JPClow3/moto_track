import { expect, test, type Page } from "@playwright/test";

/**
 * The app shell needs a real Neon Auth session, so these checks stay green in
 * the offline test environment and run in CI when a test account is supplied.
 */
const hasAuthEnv = Boolean(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD,
);

const appRoutes = ["/garage", "/maintenance", "/reminders", "/dashboard"];
const widths = [320, 375, 768, 1024, 1440];

async function signIn(page: Page) {
  await page.goto("/auth");
  await page.locator('input[name="email"]').fill(process.env.E2E_USER_EMAIL!);
  await page
    .locator('input[name="password"]')
    .fill(process.env.E2E_USER_PASSWORD!);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|garage|maintenance|onboarding)/);
}

test.describe("app shell responsive foundation", () => {
  test.skip(!hasAuthEnv, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run.");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("core routes stay within the viewport", async ({ page }) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });

      for (const route of appRoutes) {
        await page.goto(route);
        if (page.url().includes("/onboarding")) continue;

        const geometry = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(
          geometry.scrollWidth,
          `${route} overflows at ${width}px`,
        ).toBeLessThanOrEqual(geometry.clientWidth + 1);
      }
    }
  });

  test("mobile drawer traps focus and restores it on Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/garage");
    if (page.url().includes("/onboarding")) test.skip();

    const menuButton = page.getByRole("button", { name: "Abrir menu" });
    await menuButton.click();
    const drawer = page.locator("#app-mobile-nav");
    await expect(drawer).toBeVisible();

    const firstControl = drawer.locator("a, button, select, input").first();
    const lastControl = drawer.locator("a, button, select, input").last();
    await expect(firstControl).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(lastControl).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(firstControl).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(menuButton).toBeFocused();
  });

  test("dependent maintenance state exposes a garage action", async ({
    page,
  }) => {
    await page.goto("/maintenance");
    if (page.url().includes("/onboarding")) test.skip();

    const notice = page.getByRole("status").filter({
      hasText: /Cadastre uma moto|Add a bike/i,
    });
    if (await notice.count()) {
      await expect(
        notice.getByRole("link", { name: /garagem|garage/i }),
      ).toBeVisible();
    }
  });

  test("maintenance destructive actions require confirmation", async ({
    page,
  }) => {
    await page.goto("/maintenance");
    if (page.url().includes("/onboarding")) test.skip();

    const destructiveForm = page.locator(
      'form[action="?/deletePart"], form[action="?/deletePlan"], form[action="?/deletePhoto"]',
    );
    if (!(await destructiveForm.count())) test.skip();

    await destructiveForm
      .first()
      .getByRole("button", { name: /excluir|delete/i })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /cancelar|cancel/i }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: /cancelar|cancel/i }).click();
    await expect(dialog).toBeHidden();
  });
});
