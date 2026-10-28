import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { stringify } from "devalue";
import type { Sql } from "postgres";
import { openDisposableDb } from "./helpers/disposable-db";

type OdometerSnapshot = {
  id: string;
  name: string;
  odometer_override_km: number | null;
  odometer_override_at: string | null;
  current_odometer_km: number;
  current_odometer_updated_at: string | null;
};

async function odometerState(sql: Sql, ownerId: string, motorcycleId: string) {
  const [row] = await sql<OdometerSnapshot[]>`
    select id, name, odometer_override_km, odometer_override_at::text,
      current_odometer_km, current_odometer_updated_at::text
    from motorcycles where id = ${motorcycleId} and owner_id = ${ownerId}
  `;
  return row;
}

test.describe("nearby prices, OCR confirmation and staff manual sources", () => {
  // Multi-step journeys against a real Neon/Auth branch, like the other
  // authenticated suites; the 30s default is not enough under dev-mode Vite.
  test.describe.configure({ timeout: 300_000 });
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "Requires the dedicated disposable authenticated account.",
  );

  test("compares the latest same-grade price, separates premium and hides stale observations", async ({
    page,
    context,
    baseURL,
  }) => {
    const fixture = await openDisposableDb();
    const { sql, ownerId } = fixture;
    const marker = `Nearby ${randomUUID()}`;
    const regular = randomUUID();
    const premium = randomUUID();
    const stations = ["Latest", "Cheaper", "Premium", "Stale", "Far"].map(
      (label, index) => ({
        id: randomUUID(),
        name: `${marker} ${label}`,
        latitude: index === 4 ? -3 : -4 + (index + 1) * 0.001,
        longitude: -20,
      }),
    );
    const date = (daysAgo: number) =>
      new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
    const observations = [
      { station: 0, grade: regular, days: 2, price: 400000 },
      { station: 0, grade: regular, days: 0, price: 700000 },
      { station: 1, grade: regular, days: 1, price: 600000 },
      { station: 0, grade: premium, days: 0, price: 300000 },
      { station: 2, grade: premium, days: 0, price: 900000 },
      { station: 3, grade: regular, days: 45, price: 200000 },
      { station: 4, grade: regular, days: 0, price: 100000 },
    ].map((item) => ({ ...item, id: randomUUID() }));
    const recordIds = observations.map((item) => item.id);
    try {
      await sql.begin(async (db) => {
        await db`insert into fuel_grades (id, owner_id, name, fuel_type) values
          (${regular}, ${ownerId}, ${`${marker} Regular`}, 'gasoline'),
          (${premium}, ${ownerId}, ${`${marker} Premium`}, 'gasoline')`;
        for (const station of stations) {
          await db`insert into fuel_stations (id, owner_id, name, latitude, longitude)
            values (${station.id}, ${ownerId}, ${station.name}, ${station.latitude}, ${station.longitude})`;
        }
        for (const observation of observations) {
          await db`insert into fuel_records
            (id, owner_id, motorcycle_id, station_id, fuel_grade_id, date, odometer_km,
              liters, total_price_cents, price_per_liter_millicents, fuel_type, station_name)
            values (${observation.id}, ${ownerId}, null, ${stations[observation.station].id},
              ${observation.grade}, ${date(observation.days)}, 0, 10, ${observation.price / 100},
              ${observation.price}, 'gasoline', ${stations[observation.station].name})`;
        }
      });
      expect(baseURL).toBeTruthy();
      await context.grantPermissions(["geolocation"], {
        origin: new URL(baseURL!).origin,
      });
      // Synthetic ocean coordinates keep unrelated rider stations outside this fixture.
      await context.setGeolocation({ latitude: -4, longitude: -20 });
      await page.goto("/fuel");
      await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
      const nearby = page.locator("details").filter({
        has: page.locator("#nearby-fuel"),
      });
      await nearby.locator("summary").click();
      await nearby
        .getByRole("button", {
          name: /Usar localização atual|Use current location/i,
        })
        .click();
      await expect(nearby.locator("#nearby-latitude")).toHaveValue("-4.000000");
      await expect(nearby.locator("#nearby-longitude")).toHaveValue(
        "-20.000000",
      );
      await nearby.locator("#nearby-radius").fill("10");
      await nearby.locator("#nearby-fuel").selectOption(`gasoline::${regular}`);
      const results = nearby.locator("ul > li");
      await expect(results).toHaveCount(2);
      await expect(results.nth(0)).toContainText(stations[1].name);
      await expect(results.nth(0)).toContainText(/6,000\/L/);
      await expect(results.nth(1)).toContainText(stations[0].name);
      await expect(results.nth(1)).toContainText(/7,000\/L/);
      await expect(results.nth(1)).not.toContainText(/4,000\/L/);
      for (const index of [2, 3, 4])
        await expect(
          results.filter({ hasText: stations[index].name }),
        ).toHaveCount(0);

      await nearby.locator("#nearby-fuel").selectOption(`gasoline::${premium}`);
      await expect(results).toHaveCount(2);
      await expect(results.nth(0)).toContainText(stations[0].name);
      await expect(results.nth(0)).toContainText(/3,000\/L/);
      await expect(results.nth(1)).toContainText(stations[2].name);
      await expect(results.nth(1)).toContainText(/9,000\/L/);
      await expect(results.filter({ hasText: stations[1].name })).toHaveCount(
        0,
      );
      // Directions stay unvisited: this acceptance does not depend on external maps.
      await expect(results.nth(0).getByRole("link")).toHaveAttribute(
        "target",
        "_blank",
      );
    } finally {
      try {
        await sql.begin(async (db) => {
          await db`delete from fuel_records where owner_id = ${ownerId} and id in ${db(recordIds)}`;
          await db`delete from offline_fuel_submissions where owner_id = ${ownerId} and id in ${db(recordIds)}`;
          await db`delete from fuel_stations where owner_id = ${ownerId} and id in ${db(stations.map((station) => station.id))}`;
          await db`delete from fuel_grades where owner_id = ${ownerId} and id in ${db([regular, premium])}`;
        });
      } finally {
        await fixture.close();
      }
    }
  });

  test("OCR boundary preview does not write until the rider edits and confirms the real odometer action", async ({
    page,
  }) => {
    const fixture = await openDisposableDb();
    const { sql, ownerId } = fixture;
    let before: OdometerSnapshot | undefined;
    let createdBikeId: string | undefined;
    let reserved: Array<{ id: string }> = [];
    try {
      let [bike] = await sql<Array<{ id: string }>>`
        select id from motorcycles where owner_id = ${ownerId} and is_active = true
          and deleted_at is null order by name limit 1
      `;
      if (!bike) {
        reserved = await sql<Array<{ id: string }>>`
          select id from motorcycles where owner_id = ${ownerId} and is_active = true
        `;
        createdBikeId = randomUUID();
        const id = createdBikeId;
        await sql.begin(async (db) => {
          await db`update motorcycles set is_active = false where owner_id = ${ownerId} and is_active = true`;
          await db`insert into motorcycles (id, owner_id, name, brand, model, year, current_odometer_km)
            values (${id}, ${ownerId}, ${`OCR fixture ${id}`}, 'Fixture', 'OCR', 2026, 1000)`;
        });
        bike = { id };
      }
      const snapshot = await odometerState(sql, ownerId, bike.id);
      expect(snapshot).toBeTruthy();
      before = snapshot;
      const scannedKm = snapshot.current_odometer_km + 111;
      const confirmedKm = snapshot.current_odometer_km + 123;
      expect(confirmedKm).toBeLessThanOrEqual(2147483647);
      let scans = 0;
      let updates = 0;
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          request.method() === "POST" &&
          url.pathname === "/garage" &&
          url.search === "?/updateOdometer"
        )
          updates++;
      });
      // Only the OCR action boundary is mocked. No Mistral/provider result is claimed.
      await page.route(
        (url) => url.pathname === "/garage" && url.search === "?/scanOdometer",
        async (route) => {
          expect(route.request().method()).toBe("POST");
          expect(route.request().headers()["content-type"]).toContain(
            "multipart/form-data",
          );
          scans++;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              type: "success",
              status: 200,
              data: stringify({
                ok: true,
                odometerScan: { motorcycleId: bike.id, km: scannedKm },
              }),
            }),
          });
        },
      );
      await page.goto("/garage");
      await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
      const card = page.locator("article").filter({
        has: page.getByRole("heading", { name: snapshot.name, exact: true }),
      });
      await card.locator("details").first().locator("summary").first().click();
      const scanForm = card.locator('form[action="?/scanOdometer"]');
      const scanner = scanForm.locator("..");
      await scanner.locator(":scope > summary").click();
      await scanForm.locator('[name="photo"]').setInputFiles({
        name: "synthetic-odometer.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XkAAAAASUVORK5CYII=",
          "base64",
        ),
      });
      await scanForm.locator('button[type="submit"]').click();
      const confirmation = scanner.locator('form[action="?/updateOdometer"]');
      const reading = confirmation.locator('[name="odometer_override_km"]');
      await expect(reading).toHaveValue(String(scannedKm));
      expect(scans).toBe(1);
      expect(updates).toBe(0);
      expect(await odometerState(sql, ownerId, bike.id)).toEqual(snapshot);

      await reading.fill(String(confirmedKm));
      expect(await odometerState(sql, ownerId, bike.id)).toEqual(snapshot);
      const [saved] = await Promise.all([
        page.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === "POST" &&
            url.pathname === "/garage" &&
            url.search === "?/updateOdometer"
          );
        }),
        confirmation.locator('button[type="submit"]').click(),
      ]);
      expect(saved.status()).toBe(200);
      expect((await saved.json()).type).toBe("success");
      expect(updates).toBe(1);
      await expect
        .poll(
          async () =>
            (await odometerState(sql, ownerId, bike.id)).odometer_override_km,
        )
        .toBe(confirmedKm);
      const persisted = await odometerState(sql, ownerId, bike.id);
      expect(persisted.current_odometer_km).toBe(confirmedKm);
      expect(persisted.odometer_override_at).toBeTruthy();
      await page.reload();
      await expect(
        card
          .locator('form[action="?/updateOdometer"]')
          .first()
          .locator('[name="odometer_override_km"]'),
      ).toHaveValue(String(confirmedKm));
    } finally {
      try {
        await sql.begin(async (db) => {
          if (before) {
            await db`update motorcycles set odometer_override_km = ${before.odometer_override_km},
              odometer_override_at = ${before.odometer_override_at}::text::timestamptz, current_odometer_km = ${before.current_odometer_km},
              current_odometer_updated_at = ${before.current_odometer_updated_at}::text::timestamptz
              where id = ${before.id} and owner_id = ${ownerId}`;
          }
          if (createdBikeId)
            await db`delete from motorcycles where id = ${createdBikeId} and owner_id = ${ownerId}`;
          if (reserved.length)
            await db`update motorcycles set is_active = true where owner_id = ${ownerId} and id in ${db(reserved.map((row) => row.id))}`;
        });
        // Preserve all four odometer values exactly; general updated_at keeps its normal trigger.
        if (before && !createdBikeId)
          expect(await odometerState(sql, ownerId, before.id)).toEqual(before);
      } finally {
        await fixture.close();
      }
    }
  });

  test("staff can inspect official source versions, verification dates and item counts without editing", async ({
    page,
  }) => {
    const fixture = await openDisposableDb();
    const { sql, ownerId } = fixture;
    let originalStaff: boolean | undefined;
    try {
      const [profile] = await sql<Array<{ is_staff: boolean }>>`
        select is_staff from profiles where id = ${ownerId}
      `;
      expect(profile).toBeTruthy();
      originalStaff = profile.is_staff;
      const sources = await sql<
        Array<{
          template_id: string;
          brand: string;
          model: string;
          year_from: number;
          year_to: number | null;
          variant: string;
          is_exact_schedule: boolean;
          document_version: string;
          last_verified_date: string;
          maintenance_count: number;
        }>
      >`
        select t.id as template_id, t.brand, t.model, t.year_from, t.year_to, t.variant,
          t.is_exact_schedule, ms.document_version, ms.last_verified_date::text,
          (select count(*)::int from motorcycle_template_maintenance_items mi where mi.template_id = t.id) as maintenance_count
        from motorcycle_manual_sources ms join motorcycle_templates t on t.id = ms.template_id
        order by ms.last_verified_date asc, t.brand, t.model limit 30
      `;
      const source = sources.find(
        (row) => row.is_exact_schedule && row.maintenance_count > 0,
      );
      expect(
        source,
        "The migrated catalog must expose a verified exact schedule to staff",
      ).toBeTruthy();
      if (!source)
        throw new Error("Verified exact staff source fixture is missing.");
      expect(source.last_verified_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.document_version.length).toBeGreaterThan(0);
      await sql`update profiles set is_staff = true where id = ${ownerId}`;
      await page.goto("/admin");
      await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
      const panel = page.getByRole("region", {
        name: /Fontes do catálogo por verificação|Catalog sources by verification/i,
      });
      const table = panel.getByRole("table");
      await expect(table).toBeVisible();
      await expect(
        table.getByRole("columnheader", { name: /Verificado em|Verified on/i }),
      ).toBeVisible();
      const row = table
        .locator("tbody tr")
        .filter({
          has: page.getByRole("cell", {
            name: source.document_version,
            exact: true,
          }),
        })
        .filter({
          has: page.getByRole("cell", {
            name: `${source.year_from}–${source.year_to ?? source.year_from}`,
            exact: true,
          }),
        })
        .filter({ hasText: `${source.brand} ${source.model}` });
      await expect(row).toHaveCount(1);
      await expect(row.getByRole("cell").nth(3)).toHaveText(
        source.last_verified_date,
      );
      await expect(row.getByRole("cell").nth(4)).toHaveText(
        String(source.maintenance_count),
      );
      await expect(row.getByRole("cell").first()).toContainText(/Exata|Exact/);
      await expect(
        panel.locator("input, select, textarea, button, form"),
      ).toHaveCount(0);
      const [unchanged] = await sql<
        Array<{
          document_version: string;
          last_verified_date: string;
          maintenance_count: number;
        }>
      >`
        select ms.document_version, ms.last_verified_date::text,
          (select count(*)::int from motorcycle_template_maintenance_items mi where mi.template_id = ms.template_id) as maintenance_count
        from motorcycle_manual_sources ms where ms.template_id = ${source.template_id}
      `;
      expect(unchanged).toEqual({
        document_version: source.document_version,
        last_verified_date: source.last_verified_date,
        maintenance_count: source.maintenance_count,
      });
    } finally {
      try {
        if (originalStaff !== undefined)
          await sql`update profiles set is_staff = ${originalStaff} where id = ${ownerId}`;
      } finally {
        await fixture.close();
      }
    }
  });
});
