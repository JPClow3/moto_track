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

async function gotoAppRoute(page: Page, route: string) {
  await expect(async () => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).toBe(route);
  }).toPass({ intervals: [250, 500, 1_000], timeout: 10_000 });
  await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
}

test.describe("data surfaces responsive behavior", () => {
  test.setTimeout(300_000);
  test.skip(!hasAuthEnv, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run.");

  test("data routes remain usable at every supported width", async ({
    page,
  }) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });

      for (const route of dataRoutes) {
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

  test("generic record action persists a document", async ({ page }) => {
    await gotoAppRoute(page, "/documents");

    await page
      .getByRole("button", { name: /adicionar registro|novo registro/i })
      .first()
      .click();
    const form = page.locator(
      'form[action="?/record"]:has(input[name="_intent"][value="create"])',
    );
    await form.locator("#new-motorcycle_id").selectOption({ index: 1 });
    await form.locator("#new-name").fill("Documento E2E");
    await form.locator("#new-document_type").fill("Validação de release");
    await form.getByRole("button", { name: /salvar|save/i }).click();

    await expect(page.getByText("Documento E2E").first()).toBeVisible();
  });
});
