import { expect, test } from "@playwright/test";

// Exercise CSP itself, without the PWA's offline navigation fallback.
test.use({ serviceWorkers: "block" });

const authOrigin = new URL(
  process.env.PUBLIC_NEON_AUTH_URL ??
    "https://ep-damp-bar-acu29m6g.neonauth.sa-east-1.aws.neon.tech/neondb/auth",
).origin;

for (const [origin, allowed] of [
  [authOrigin, true],
  ["https://accounts.google.com", true],
  ["https://appleid.apple.com", true],
  ["https://untrusted.example", false],
] as const) {
  test(`social login CSP ${allowed ? "allows" : "blocks"} ${origin}`, async ({
    page,
    context,
  }) => {
    const target = `${origin}/oauth-csp-test`;
    await page.route(/\/auth\?\/google$/, (route) =>
      route.fulfill({
        status: 303,
        headers: { location: target },
      }),
    );
    await page.goto("/auth");
    await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1, {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("button", { name: "Google", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Apple", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Criar conta", exact: true }).click();
    await expect(
      page.getByRole("tab", { name: "Criar conta", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("button", { name: "Google", exact: true }),
    ).toBeVisible();
    // Stay offline: an allowed destination fails at the network boundary;
    // a forbidden destination must fail earlier at the browser's CSP boundary.
    // No provider is contacted and no real OAuth login is started.
    await context.setOffline(true);
    if (allowed) {
      const [failed] = await Promise.all([
        page.waitForEvent("requestfailed", {
          predicate: (request) => request.url() === target,
        }),
        page
          .getByRole("button", { name: "Google", exact: true })
          .click({ noWaitAfter: true }),
      ]);
      expect(failed.failure()?.errorText).toBe(
        "net::ERR_INTERNET_DISCONNECTED",
      );
    } else {
      const [violation] = await Promise.all([
        page.waitForEvent("console", {
          predicate: (message) => message.text().includes("form-action"),
        }),
        page
          .getByRole("button", { name: "Google", exact: true })
          .click({ noWaitAfter: true }),
      ]);
      expect(violation.type()).toBe("error");
      await expect(page).toHaveURL(/\/auth$/);
    }
  });
}
