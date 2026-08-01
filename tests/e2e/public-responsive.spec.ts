import { expect, test, type Page } from "@playwright/test";

const widths = [320, 375, 768, 1024, 1440];
const publicRoutes = ["/", "/roadmap", "/precos", "/blog"];

const waitForAppReady = (page: Page) =>
  expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);

test.describe("public responsive foundation", () => {
  test("public routes do not overflow and expose usable shell controls", async ({
    page,
  }) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });

      for (const route of publicRoutes) {
        await page.goto(route);

        const geometry = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(
          geometry.scrollWidth,
          `${route} overflows at ${width}px`,
        ).toBeLessThanOrEqual(geometry.clientWidth + 1);

        const shellControls = page.locator(
          "header a:visible, header button:visible, header select:visible, footer a:visible",
        );
        const heights = await shellControls.evaluateAll((elements) =>
          elements.map((element) =>
            Math.round(element.getBoundingClientRect().height),
          ),
        );
        expect(
          heights.every((height) => height >= 44),
          `${route} has a shell control shorter than 44px at ${width}px: ${heights.join(", ")}`,
        ).toBe(true);
      }
    }
  });

  test("mobile navigation manages focus when opened and dismissed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/roadmap");
    await waitForAppReady(page);

    const menuButton = page.getByRole("button", { name: "Abrir menu" });
    await menuButton.click();
    await expect(
      page.getByRole("button", { name: "Fechar menu" }),
    ).toBeVisible();
    await expect(page.locator("#mobile-nav a").first()).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Abrir menu" }),
    ).toBeFocused();
    await expect(page.locator("#mobile-nav")).toHaveCount(0);
  });

  test("signup preserves checkout intent and auth feedback is announced", async ({
    page,
  }) => {
    await page.goto("/auth?redirectTo=%2Fbilling%2Fcheckout");
    await waitForAppReady(page);
    await page.getByRole("tab", { name: "Criar conta" }).click();

    const signupEmail = page.locator("#signup-email");
    const signupPassword = page.locator("#signup-password");
    await expect(signupEmail).toHaveAccessibleName("Email");
    await expect(signupEmail).toHaveAttribute("autocomplete", "email");
    await expect(signupPassword).toHaveAccessibleName("Senha");
    await expect(signupPassword).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    await expect(
      page.locator('#auth-sign-up input[name="redirectTo"]'),
    ).toHaveValue("/billing/checkout");

    await page.goto("/auth?message=senha_atualizada");
    await expect(page.getByRole("status")).toContainText("Senha atualizada");
  });
});
