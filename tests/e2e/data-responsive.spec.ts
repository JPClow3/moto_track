import { expect, test, type Page } from "@playwright/test";

/**
 * Data-heavy routes are exercised with a real account when CI provides one.
 * Keeping the suite skipped without credentials preserves the repository's
 * offline test contract while still guarding the authenticated surfaces in
 * preview runs.
 */
const hasAuthEnv = Boolean(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD,
);

const widths = [320, 375, 768, 1024, 1440];
const dataRoutes = [
  "/fuel",
  "/expenses",
  "/tires",
  "/documents",
  "/reports",
  "/trabalho",
];

async function signIn(page: Page) {
  await page.goto("/auth");
  await page.locator('input[name="email"]').fill(process.env.E2E_USER_EMAIL!);
  await page
    .locator('input[name="password"]')
    .fill(process.env.E2E_USER_PASSWORD!);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|garage|maintenance|onboarding)/);
}

test.describe("data surfaces responsive behavior", () => {
  test.skip(!hasAuthEnv, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run.");

  test("data routes remain usable at every supported width", async ({
    page,
  }) => {
    await signIn(page);

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });

      for (const route of dataRoutes) {
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

        const smallButtons = await page
          .locator("main button:visible")
          .evaluateAll((buttons) =>
            buttons
              .map((button) => {
                const box = button.getBoundingClientRect();
                return {
                  label: button.textContent?.trim(),
                  height: box.height,
                };
              })
              .filter(({ height }) => height < 44),
          );
        expect(
          smallButtons,
          `${route} has a touch target below 44px at ${width}px`,
        ).toEqual([]);

        const unlabeledFields = await page.evaluate(() => {
          const fields = Array.from(
            document.querySelectorAll<
              HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
            >("main input:not([type=hidden]), main select, main textarea"),
          ).filter((field) => {
            const box = field.getBoundingClientRect();
            return box.width > 0 && box.height > 0;
          });

          return fields
            .filter((field) => {
              const labelledBy = field.getAttribute("aria-labelledby");
              const hasAria = Boolean(
                field.getAttribute("aria-label") || labelledBy,
              );
              const hasLabel = Boolean(
                field.id &&
                document.querySelector(`label[for="${CSS.escape(field.id)}"]`),
              );
              return !hasAria && !hasLabel && !field.closest("label");
            })
            .map((field) => field.name || field.type || field.tagName);
        });
        expect(
          unlabeledFields,
          `${route} has a visible form control without an accessible label at ${width}px`,
        ).toEqual([]);
      }
    }
  });
});
