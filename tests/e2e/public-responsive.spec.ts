import { expect, test, type Page } from "@playwright/test";

const widths = [320, 375, 768, 1024, 1440];
const publicRoutes = ["/", "/roadmap", "/precos", "/blog"];

const waitForAppReady = (page: Page) =>
  expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);

test.describe("public responsive foundation", () => {
  test("public routes do not overflow and expose usable shell controls", async ({
    page,
  }) => {
    // This is a deliberately broad smoke test: five viewport sizes x four
    // full navigations. Give cold Vite/DB-backed public routes enough budget
    // to finish before Playwright cancels the in-flight navigation as
    // ERR_ABORTED.
    test.setTimeout(120_000);

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

  test("mobile navigation closes on an outside touch and still follows its links", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      locale: "pt-BR",
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    try {
      const page = await context.newPage();
      await page.goto("/roadmap");
      await waitForAppReady(page);

      const menuButton = page.getByRole("button", { name: "Abrir menu" });
      await menuButton.tap();
      await expect(page.locator("#mobile-nav")).toBeVisible();
      await page.touchscreen.tap(16, 780);
      await expect(page.locator("#mobile-nav")).toHaveCount(0);
      await expect(menuButton).toBeFocused();

      await menuButton.tap();
      await page
        .locator("#mobile-nav")
        .getByRole("link", { name: "Planos" })
        .tap();
      await expect(page).toHaveURL(/\/precos$/);
      await expect(page.locator("#mobile-nav")).toHaveCount(0);
    } finally {
      await context.close();
    }
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

    await page.goto(
      "/auth?redirectTo=%2Fbilling%2Fcheckout&error=oauth_callback_failed",
    );
    await expect(page.getByRole("alert")).toContainText(
      "Não foi possível concluir o acesso.",
    );
    await expect(page.getByRole("alert")).toContainText("Tente novamente");
    await expect(
      page.locator('#auth-sign-in input[name="redirectTo"]').first(),
    ).toHaveValue("/billing/checkout");
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`overdue status text meets AA contrast in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await waitForAppReady(page);
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      colorScheme,
    );

    const badge = page.locator('.status-badge[data-tone="overdue"]').first();
    await badge.scrollIntoViewIfNeeded();
    const contrast = await badge.evaluate((element) => {
      const rgba = (value: string) => {
        const values = value.match(/[\d.]+/g)!.map(Number);
        return [values[0], values[1], values[2], values[3] ?? 1];
      };
      const composite = (foreground: number[], background: number[]) => [
        ...foreground
          .slice(0, 3)
          .map(
            (value, i) =>
              value * foreground[3] + background[i] * (1 - foreground[3]),
          ),
        1,
      ];
      const backgrounds: number[][] = [];
      let current: Element | null = element;
      while (current) {
        backgrounds.unshift(rgba(getComputedStyle(current).backgroundColor));
        current = current.parentElement;
      }
      const background = backgrounds.reduce(
        (under, over) => composite(over, under),
        [255, 255, 255, 1],
      );
      const foreground = composite(
        rgba(getComputedStyle(element).color),
        background,
      );
      const luminance = (color: number[]) =>
        color.slice(0, 3).reduce((sum, value, i) => {
          const channel = value / 255;
          const linear =
            channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4;
          return sum + linear * [0.2126, 0.7152, 0.0722][i];
        }, 0);
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));
      return (light + 0.05) / (dark + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
}
