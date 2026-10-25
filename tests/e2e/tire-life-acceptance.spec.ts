import { expect, test, type Page } from "@playwright/test";

const hasAuth = Boolean(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD,
);

type Row = Record<string, unknown> & { id: string };

async function rows(page: Page, resource: string): Promise<Row[]> {
  const response = await page.request.get(`/api/v1/${resource}`);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).results;
}

test.describe("confirmed tire wear observations", () => {
  // Multi-step journeys against a real Neon/Auth branch, like the other
  // authenticated suites; the 30s default is not enough under dev-mode Vite.
  test.describe.configure({ timeout: 300_000 });
  test.skip(!hasAuth, "Requires the disposable Neon/Auth account.");

  test("remaining distance falls with use and only a confirmed observation resets the wear baseline", async ({
    page,
  }) => {
    await page.goto("/garage");
    await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
    const bikeForm = page.locator('form[action="?/updateOdometer"]').first();
    const motorcycleId = await bikeForm
      .locator('input[name="motorcycle_id"]')
      .inputValue();
    const currentKm = Number(
      await bikeForm.locator('input[name="odometer_override_km"]').inputValue(),
    );
    expect(
      currentKm,
      "Acceptance needs a bike with at least 1,000 recorded km",
    ).toBeGreaterThanOrEqual(1000);
    const marker = `tire-observation-${Date.now()}`;
    let tireId = "";
    let fuelId = "";
    const card = page.locator("article").filter({
      has: page.getByRole("heading", { name: marker, exact: true }),
    });
    try {
      const created = await page.request.post("/api/v1/tire-records", {
        data: {
          motorcycle_id: motorcycleId,
          installed_at: "2026-01-01",
          position: "rear",
          brand_model: marker,
          installed_odometer_km: currentKm - 1000,
          cost_cents: 100,
          wear_percent: 40,
          is_active: true,
        },
      });
      expect(created.status(), await created.text()).toBe(201);
      tireId = (await created.json()).result.id;
      const original = (await rows(page, "tire-records")).find(
        (r) => r.id === tireId,
      )!;
      expect(Number(original.wear_odometer_km)).toBe(currentKm);
      expect(original.wear_observed_at).toBeTruthy();
      await page.goto("/tires");
      await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
      await expect(
        card.getByText("≈1.500 km restantes", { exact: true }),
      ).toBeVisible();

      const fuel = await page.request.post("/api/v1/fuel-records", {
        data: {
          motorcycle_id: motorcycleId,
          date: new Date().toISOString().slice(0, 10),
          odometer_km: currentKm + 100,
          liters: 10,
          total_price: 60,
          price_per_liter: 6,
          fuel_type: "gasoline",
          tank_full: true,
          station_name: marker,
        },
      });
      expect(fuel.status(), await fuel.text()).toBe(201);
      fuelId = (await fuel.json()).result.id;
      await page.reload();
      await expect(
        card.getByText("≈1.400 km restantes", { exact: true }),
      ).toBeVisible();

      const metadata = await page.request.patch("/api/v1/tire-records", {
        data: {
          id: tireId,
          motorcycle_id: motorcycleId,
          installed_at: "2026-01-01",
          position: "rear",
          brand_model: marker,
          installed_odometer_km: currentKm - 1000,
          cost_cents: 125,
          wear_percent: 40,
          is_active: true,
        },
      });
      expect(metadata.ok(), await metadata.text()).toBe(true);
      const preserved = (await rows(page, "tire-records")).find(
        (r) => r.id === tireId,
      )!;
      expect(Number(preserved.wear_odometer_km)).toBe(currentKm);
      expect(preserved.wear_observed_at).toBe(original.wear_observed_at);
      await page.reload();
      await expect(
        card.getByText("≈1.400 km restantes", { exact: true }),
      ).toBeVisible();

      await card.locator("details summary").click();
      await card.getByLabel("Desgaste (%)", { exact: true }).fill("40");
      await card
        .getByRole("button", { name: "Registrar medição", exact: true })
        .click();
      await expect(
        card.getByText("≈1.650 km restantes", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        card.getByText("≈1.650 km restantes", { exact: true }),
      ).toBeVisible();
      const confirmed = (await rows(page, "tire-records")).find(
        (r) => r.id === tireId,
      )!;
      expect(Number(confirmed.wear_odometer_km)).toBe(currentKm + 100);
      expect(confirmed.wear_observed_at).not.toBe(original.wear_observed_at);
    } finally {
      if (fuelId) {
        const deleted = await page.request.delete(
          `/api/v1/fuel-records?id=${fuelId}`,
        );
        expect(deleted.ok(), await deleted.text()).toBe(true);
      }
      if (tireId) {
        const deleted = await page.request.delete(
          `/api/v1/tire-records?id=${tireId}`,
        );
        expect(deleted.ok(), await deleted.text()).toBe(true);
      }
    }
  });
});
