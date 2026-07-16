import { expect, test } from "@playwright/test";

test.describe("language follows the reader", () => {
  test("an English system language renders the app in English", async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/precos");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { name: /choose your plan/i }),
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

  test("an explicit choice overrides the system language and persists", async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: "pt-BR" });
    const page = await context.newPage();
    await page.goto("/precos");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");

    // The select submits its form from an on:change handler, which only exists
    // once Svelte has hydrated. Without this wait the change fires against
    // server-rendered HTML with no listener attached and is silently dropped.
    await page.waitForLoadState("networkidle");
    await page.selectOption("#locale-select", "en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { name: /choose your plan/i }),
    ).toBeVisible();

    // The cookie must outlive the navigation, or the choice resets on the next
    // page — which is the whole point of storing it.
    await page.goto("/roadmap");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await context.close();
  });
});
