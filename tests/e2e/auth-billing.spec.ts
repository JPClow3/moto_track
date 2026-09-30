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

  test("reaches garage + conta with the CI session", async ({ page }) => {
    await page.goto("/garage");
    await expect(page.getByRole("heading").first()).toBeVisible();

    await page.goto("/billing/conta");
    await expect(
      page.getByRole("heading", { name: /Conta|Account/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /export|exportação/i }),
    ).toBeVisible();

    await page.goto("/billing/conta?checkout=returned");
    await expect(
      page.getByText(/estamos verificando sua assinatura/i),
    ).toBeVisible();
  });

  test("account settings hydrate inside the app shell and persist the theme", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/billing/conta");
    await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
    const bootstrapScripts = page.locator("script[nonce]");
    expect(await bootstrapScripts.count()).toBeGreaterThan(0);
    expect(
      await bootstrapScripts.evaluateAll((scripts) =>
        scripts.every(
          (script) => script.getAttribute("data-cfasync") === "false",
        ),
      ),
      "Cloudflare must preserve nonce-protected app scripts",
    ).toBe(true);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Conta e assinatura", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: "Conta e assinatura", exact: true })
        .filter({ visible: true }),
    ).toHaveAttribute("aria-current", "page");

    const tokens = main.locator("details").filter({
      has: page.locator("summary").filter({ hasText: "Tokens de API" }),
    });
    await tokens.locator("summary").click();
    await expect(tokens.getByText(/Carregando tokens/)).toHaveCount(0);
    await expect(
      tokens.getByText("Não foi possível carregar os tokens.", { exact: true }),
    ).toHaveCount(0);
    await expect(
      tokens.getByRole("button", { name: "Criar token", exact: true }),
    ).toBeEnabled();

    // CI normally uses a Free account. A paid fixture also checks the browser
    // date rendering; the Date-object regression is covered by unit tests.
    const billingDate = main.getByTestId("next-billing-date");
    if (await billingDate.count()) {
      await expect(billingDate).toHaveAttribute(
        "datetime",
        /^\d{4}-\d{2}-\d{2}/,
      );
      await expect(billingDate).toHaveText(/\d{1,2} de [a-zç]+ de \d{4}/i);
    }

    const theme = main.getByLabel("Tema", { exact: true });
    const original = await theme.inputValue();
    const updated = original === "dark" ? "light" : "dark";
    async function selectTheme(value: string) {
      const [response] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/theme" &&
            response.request().method() === "POST",
        ),
        theme.selectOption(value),
      ]);
      expect(response.ok(), await response.text()).toBe(true);
      await expect(main.getByRole("status")).toContainText("Tema salvo");
    }
    try {
      await selectTheme(updated);
      await expect(page.locator("html")).toHaveAttribute("data-theme", updated);
      await page.reload();
      await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
      await expect(theme).toHaveValue(updated);
    } finally {
      await selectTheme(original);
    }
  });

  test("account controls fit on mobile and protect the deletion request", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/billing/conta");
    await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
    const main = page.getByRole("main");
    const danger = main.locator("details").filter({
      has: page.locator("summary").filter({ hasText: "Excluir conta" }),
    });
    const form = danger.locator('form[action="?/requestDeletion"]');
    await expect(form).toBeHidden();
    await danger.locator("summary").click();
    const confirmation = form.locator('input[name="confirmation"]');
    const submit = form.getByRole("button", { name: "Solicitar exclusão" });
    await expect(submit).toBeDisabled();
    for (const invalid of ["excluir", "EXCLUIR ", "INVALIDO"]) {
      await confirmation.fill(invalid);
      await expect(submit).toBeDisabled();
    }
    await confirmation.fill("EXCLUIR");
    await expect(submit).toBeEnabled();
    await confirmation.clear();
    await expect(submit).toBeDisabled();

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);

    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    const accountLink = page
      .locator("#app-mobile-nav")
      .getByRole("link", { name: "Conta e assinatura", exact: true });
    await expect(accountLink).toBeVisible();
    await expect(accountLink).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(page.locator("#app-mobile-nav")).toHaveCount(0);
  });
});

test("billing portal redirects unauthenticated users to sign-in", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/billing/portal");
  await expect(page).toHaveURL(/\/auth\?redirectTo=/);
});

test("yearly checkout keeps its billing interval through sign-in", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/billing/checkout?interval=yearly");
  await expect(page).toHaveURL(
    /\/auth\?redirectTo=%2Fbilling%2Fcheckout%3Finterval%3Dyearly/,
  );
});
