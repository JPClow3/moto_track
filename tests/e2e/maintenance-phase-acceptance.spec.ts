import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { motorcycleSlots, openDisposableDb } from "./helpers/disposable-db";
import { reserveFreeMotorcycleSlot } from "./helpers/free-slot";

test.describe("exact catalog item occurrence acceptance", () => {
  // Multi-step journeys against a real Neon/Auth branch, like the other
  // authenticated suites; the 30s default is not enough under dev-mode Vite.
  test.describe.configure({ timeout: 300_000 });
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "Requires the dedicated disposable authenticated account.",
  );

  test("resolves the exact model year and persists per-item occurrences without skipping booklet reviews", async ({
    page,
  }) => {
    const fixture = await openDisposableDb();
    const { sql, ownerId } = fixture;
    const name = `Dafra occurrence ${randomUUID()}`;
    const slot = await reserveFreeMotorcycleSlot(sql, ownerId);
    try {
      const [template] = await sql<Array<{ id: string; model_id: string }>>`
        select id, model_id from motorcycle_templates where brand = 'Dafra' and model = 'NH 190'
          and year_from = 2026 and year_to = 2026 and is_exact_schedule = true and is_catalog_visible = true
      `;
      expect(
        template,
        "The verified exact NH190 model-year fixture must be migrated",
      ).toBeTruthy();
      await page.goto("/garage");
      await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
      await page
        .getByRole("button", {
          name: /Adicionar moto|Nova moto|Add motorcycle/i,
        })
        .first()
        .click();
      const create = page.locator('form[action="?/create"]');
      await create.locator('[name="name"]').fill(name);
      await create.locator("select").nth(0).selectOption("Dafra");
      await create.locator("select").nth(1).selectOption(template.model_id);
      await create.locator('select[name="year"]').selectOption("2025");
      await expect(create.locator('[name="model_id"]')).toHaveValue(
        template.model_id,
      );
      await create.locator('select[name="year"]').selectOption("2026");
      await create.locator('[name="current_odometer_km"]').fill("12000");
      await expect(
        create.locator('button[type="submit"]'),
        `Free slot should be open; motorcycles: ${await motorcycleSlots(sql, ownerId)}`,
      ).toBeEnabled();
      // Prefer the visible garage heading over waitForResponse alone — cold
      // Vite + Neon on CI can exceed 60s before the enhance response settles,
      // while a late create after failed cleanup would poison later Free-slot suites.
      await create.locator('button[type="submit"]').click();
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible({ timeout: 120_000 });
      const [bike] = await sql<
        Array<{ id: string; source_template_id: string }>
      >`select id, source_template_id from motorcycles where owner_id = ${ownerId} and name = ${name}`;
      expect(
        bike,
        `create did not persist (${await motorcycleSlots(sql, ownerId)})`,
      ).toBeTruthy();
      const bikeId = bike.id;
      expect(bike.source_template_id).toBe(template.id);
      await sql`update motorcycles set in_service_date = '2026-01-01' where id = ${bikeId} and owner_id = ${ownerId}`;

      const cases = [
        {
          type: "Folga de válvulas",
          completedKm: 6000,
          firstMonths: 18,
          nextKm: 12000,
          nextMonths: 30,
        },
        {
          type: "Filtro de ar - troca",
          completedKm: 12000,
          firstMonths: 30,
          nextKm: 24000,
          nextMonths: 54,
        },
      ];
      for (const item of cases) {
        await page.goto("/maintenance");
        await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(
          1,
        );
        const card = page
          .locator("article")
          .filter({ hasText: name })
          .filter({
            has: page.getByRole("heading", { name: item.type, exact: true }),
          });
        await card.locator("summary").click();
        const history = card.locator('form[action="?/updateHistory"]');
        await history
          .locator('[name="initial_history_status"]')
          .selectOption("confirmed_done");
        await history
          .locator('[name="last_done_km"]')
          .fill(String(item.completedKm));
        await history
          .locator('[name="last_done_date"]')
          .fill(new Date().toISOString().slice(0, 10));
        const occurrence = history.locator(
          'select[name="last_completed_milestone"]',
        );
        await expect(occurrence.locator('option[value="1"]')).toContainText(
          new RegExp(
            `1.*${item.completedKm.toLocaleString("pt-BR").replace(".", "\\.")}.*${item.firstMonths}`,
          ),
        );
        await occurrence.selectOption("1");
        await expect(
          history.locator('[name="initial_history_status"]'),
        ).toHaveValue("confirmed_done");
        await history.locator('button[type="submit"]').click();
        await expect
          .poll(
            async () =>
              (
                await sql`select baseline_completed_milestone from maintenance_plan_items
          where owner_id = ${ownerId} and motorcycle_id = ${bikeId} and maintenance_type = ${item.type}`
              )[0].baseline_completed_milestone,
          )
          .toBe(1);
        await page.reload();
        await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(
          1,
        );
        await expect(card).toContainText(item.nextKm.toLocaleString("pt-BR"));
        await card.locator("summary").click();
        await expect(
          card.locator('select[name="last_completed_milestone"]'),
        ).toHaveValue("1");
        await expect(
          card.locator(
            'select[name="last_completed_milestone"] option[value="2"]',
          ),
        ).toContainText(
          new RegExp(
            `${item.nextKm.toLocaleString("pt-BR").replace(".", "\\.")}.*${item.nextMonths}`,
          ),
        );
      }
    } finally {
      try {
        const created = await sql<Array<{ id: string }>>`
          select id from motorcycles where owner_id = ${ownerId} and name = ${name}
        `;
        await slot.restore({
          deleteMotorcycleIds: created.map((row) => row.id),
        });
      } finally {
        await fixture.close();
      }
    }
  });
});
