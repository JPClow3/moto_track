import { expect, test } from "@playwright/test";

test.describe("released locale", () => {
  test("an English system language stays in pt-BR until English is complete", async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/precos");

    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(
      page.getByRole("heading", { name: /escolha o seu plano/i }),
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

  test("q-weights are honoured over header order", async ({ browser }) => {
    // en comes first but is weighted lower, so pt-BR must win.
    const context = await browser.newContext({
      extraHTTPHeaders: { "accept-language": "en;q=0.8, pt-BR;q=0.9" },
    });
    const page = await context.newPage();
    await page.goto("/precos");

    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await context.close();
  });

  test("does not expose an unfinished locale selector", async ({ browser }) => {
    const context = await browser.newContext({ locale: "pt-BR" });
    const page = await context.newPage();
    await page.goto("/precos");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");

    await expect(page.locator("#locale-select")).toHaveCount(0);
    await context.close();
  });
});
