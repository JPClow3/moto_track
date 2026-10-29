import { expect, test } from "@playwright/test";

test.describe("English branch acceptance", () => {
  test("negotiates English for an English system and renders public, authentication and error states", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ baseURL, locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/precos");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { name: /choose your plan/i }),
    ).toBeVisible();
    await page.goto("/auth");
    await expect(
      page.getByRole("heading", { name: "Access your garage." }),
    ).toBeVisible();
    await page.goto("/not-a-real-moto-track-page");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible();
    await context.close();
  });

  test("a Brazilian system language renders the app in pt-BR", async ({
    page,
  }) => {
    // Inherits locale: "pt-BR" from the config.
    await page.goto("/precos");

    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(
      page.getByRole("heading", { name: /escolha o seu plano/i }),
    ).toBeVisible();
  });

  test("q-weights are honoured over header order", async ({
    browser,
    baseURL,
  }) => {
    // en comes first but is weighted lower, so pt-BR must win.
    const context = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "accept-language": "en;q=0.8, pt-BR;q=0.9" },
    });
    const page = await context.newPage();
    await page.goto("/precos");

    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await context.close();
  });

  test("explicit selector choice overrides the system and preserves the current path and query", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ baseURL, locale: "pt-BR" });
    const page = await context.newPage();
    await page.goto("/precos?source=locale-acceptance");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);

    await page.locator("#locale-select").selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      "/precos?source=locale-acceptance",
    );
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(
      (await context.cookies()).find((cookie) => cookie.name === "locale")
        ?.value,
    ).toBe("en");
    await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
    await page.locator("#locale-select").selectOption("pt-BR");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await context.close();
  });

  test("switches language with JavaScript disabled and isolates concurrent reader choices", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      locale: "pt-BR",
      javaScriptEnabled: false,
    });
    const other = await browser.newContext({ baseURL, locale: "pt-BR" });
    const page = await context.newPage();
    const otherPage = await other.newPage();
    await page.goto("/precos");
    await page.locator("#locale-select").selectOption("en");
    await page
      .locator("form[action='/locale']")
      .first()
      .getByRole("button", { name: "OK" })
      .click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await otherPage.goto("/precos");
    await expect(otherPage.locator("html")).toHaveAttribute("lang", "pt-BR");
    await Promise.all([context.close(), other.close()]);
  });
});
