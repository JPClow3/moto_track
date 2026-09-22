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

async function gotoAppRoute(page: Page, route: string) {
  await expect(async () => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).toBe(route);
  }).toPass({ intervals: [250, 500, 1_000], timeout: 10_000 });
  await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
}

test.describe("app shell responsive foundation", () => {
  // Twenty authenticated navigations across five viewport sizes can exceed
  // two minutes while a newly created Neon branch is cold. Assertions retain
  // their normal per-operation limits; only the aggregate matrix budget grows.
  test.setTimeout(240_000);
  test.skip(!hasAuthEnv, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run.");

  test("core routes stay within the viewport", async ({ page }) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });

      for (const route of appRoutes) {
        await gotoAppRoute(page, route);
        expect(page.url(), `${route} redirected to onboarding`).not.toContain(
          "/onboarding",
        );

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
    await gotoAppRoute(page, "/garage");
    expect(page.url()).not.toContain("/onboarding");

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
    await gotoAppRoute(page, "/maintenance");
    expect(page.url()).not.toContain("/onboarding");

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
    await gotoAppRoute(page, "/maintenance");
    expect(page.url()).not.toContain("/onboarding");

    let destructiveForm = page.locator(
      'form[action="?/deletePart"], form[action="?/deletePlan"], form[action="?/deletePhoto"]',
    );
    if (!(await destructiveForm.count())) {
      await page
        .getByRole("button", { name: /agendar|plano|schedule/i })
        .first()
        .click();
      await page.locator("#plan-motorcycle").selectOption({ index: 1 });
      await page.locator("#plan-type").fill("Verificação E2E");
      await page.locator("#plan-interval-km").fill("5000");
      await page
        .locator('form[action="?/savePlan"]')
        .getByRole("button", { name: /salvar|save/i })
        .click();
      destructiveForm = page.locator(
        'form[action="?/deletePart"], form[action="?/deletePlan"], form[action="?/deletePhoto"]',
      );
      await expect(destructiveForm.first()).toBeVisible();
    }

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
