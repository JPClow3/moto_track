import { expect, test } from "@playwright/test";

test("demo explores every view with mouse and keyboard without signing in", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Sua moto",
  );
  await expect(
    page.getByText("Dados de exemplo", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Combustível", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("32,1 km/L");
  await page
    .getByRole("tab", { name: "Combustível", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Manutenção", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Troca de óleo e filtro",
  );
  await page.getByRole("tab", { name: "Manutenção", exact: true }).press("End");
  await expect(page.getByRole("tabpanel")).toContainText("Em 520 km");
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Visão geral", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(new URL(page.url()).pathname).toBe("/demo");
});

for (const width of [375, 768, 1440]) {
  test("launch pages remain usable at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/demo", "/instalar", "/suporte", "/midia"]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const broken = await page
        .locator("img")
        .evaluateAll((images) =>
          images.some(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth === 0,
          ),
        );
      expect(broken).toBe(false);
    }
  });
}

test("launch pages localize to English and media respects reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/instalar");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your garage",
  );
  await page.goto("/midia");
  await expect(
    page.getByRole("button", { name: "Replay animations" }),
  ).toBeVisible();
  expect(
    await page
      .locator("svg.motion")
      .evaluateAll((svgs) =>
        svgs.every((svg) =>
          [...svg.querySelectorAll(".bar,.trace,.entry,.ring")].every(
            (el) => getComputedStyle(el).animationName === "none",
          ),
        ),
      ),
  ).toBe(true);
  await context.close();
});

test("native mobile distribution removes hosted purchases while account rights remain reachable", async ({
  browser,
}) => {
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 MotoTrackNative/Android",
    locale: "pt-BR",
  });
  const page = await context.newPage();
  for (const route of [
    "/precos",
    "/billing/checkout?plan=pro",
    "/billing/portal",
    "/billing/",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/app-info$/);
    await expect(
      page.getByRole("link", { name: "Planos", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "A conta da sua moto.",
    );
  }
  await page.goto("/auth");
  await expect(
    page.getByRole("button", { name: "Google", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Neste app, use seu email e senha para entrar."),
  ).toBeVisible();
  const blockedSocial = await context.request.post("/auth?/google", {
    form: {},
    headers: {
      origin: new URL(page.url()).origin,
      accept: "text/html",
      "user-agent": "Mozilla/5.0 MotoTrackNative/Android",
    },
  });
  expect(blockedSocial.status()).toBe(403);
  await page.goto("/billing/conta");
  await expect(page).toHaveURL(/\/auth\?redirectTo=/);
  await context.close();
});
