import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { openDisposableDb } from "./helpers/disposable-db";

test.describe("legacy reference privacy", () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "Requires the dedicated disposable authenticated account.",
  );

  test("old cross-owner references never disclose the foreign motorcycle, service or insurance", async ({
    page,
  }) => {
    const fixture = await openDisposableDb();
    const { sql, ownerId } = fixture;
    const foreignOwner = randomUUID();
    const bike = randomUUID();
    const policy = randomUUID();
    const foreignRecord = randomUUID();
    const ids = {
      tire: randomUUID(),
      pressure: randomUUID(),
      service: randomUUID(),
      plan: randomUUID(),
      photo: randomUUID(),
      claim: randomUUID(),
    };
    const marker = `Legacy ${randomUUID()}`;
    const privateBike = `Private motorcycle ${randomUUID()}`;
    const privateService = `Private service ${randomUUID()}`;
    const privateProvider = `Private insurer ${randomUUID()}`;
    const privateNumber = `Private policy ${randomUUID()}`;
    try {
      // Deliberately seed the invalid relationships accepted by old versions.
      // New form/API reference guards must not be bypassed in ordinary use.
      await sql.begin(async (db) => {
        await db`insert into neon_auth."user"
          (id, name, email, "emailVerified", "createdAt", "updatedAt")
          values (${foreignOwner}, 'Legacy privacy fixture', ${`privacy-${foreignOwner}@example.invalid`}, true, now(), now())`;
        await db`insert into motorcycles (id, owner_id, name, brand, model, year, current_odometer_km)
          values (${bike}, ${foreignOwner}, ${privateBike}, 'Fixture', 'Privacy', 2026, 1234567)`;
        await db`insert into maintenance_records
          (id, owner_id, motorcycle_id, maintenance_type, date, odometer_km)
          values (${foreignRecord}, ${foreignOwner}, ${bike}, ${privateService}, current_date, 1234567)`;
        await db`insert into insurance_policies
          (id, owner_id, motorcycle_id, provider, policy_number, coverage_start, coverage_end)
          values (${policy}, ${foreignOwner}, ${bike}, ${privateProvider}, ${privateNumber}, current_date, current_date + 365)`;
        await db`insert into tire_records
          (id, owner_id, motorcycle_id, position, brand_model, installed_at, installed_odometer_km)
          values (${ids.tire}, ${ownerId}, ${bike}, 'front', ${`${marker} tire`}, current_date, 1000)`;
        await db`insert into tire_pressure_records
          (id, owner_id, motorcycle_id, date, psi_front, psi_rear, notes)
          values (${ids.pressure}, ${ownerId}, ${bike}, current_date, 29, 33, ${`${marker} pressure`})`;
        await db`insert into maintenance_records
          (id, owner_id, motorcycle_id, maintenance_type, date, odometer_km, description)
          values (${ids.service}, ${ownerId}, ${bike}, 'inspection', current_date, 1000, ${`${marker} service`})`;
        await db`insert into maintenance_plan_items
          (id, owner_id, motorcycle_id, maintenance_type, interval_km, initial_history_status, notes)
          values (${ids.plan}, ${ownerId}, ${bike}, ${`${marker} plan`}, 1, 'not_done', ${marker})`;
        await db`insert into maintenance_photos
          (id, owner_id, maintenance_record_id, image_key, caption)
          values (${ids.photo}, ${ownerId}, ${foreignRecord}, ${`fixture/${ids.photo}.png`}, ${`${marker} photo`})`;
        await db`insert into insurance_claims
          (id, owner_id, policy_id, claim_date, description)
          values (${ids.claim}, ${ownerId}, ${policy}, current_date, ${`${marker} claim`})`;
      });
      for (const [route, ownMarkers] of [
        ["/tires", [`${marker} tire`, `${marker} pressure`]],
        [
          "/maintenance",
          [`${marker} service`, `${marker} plan`, `${marker} photo`],
        ],
        ["/expenses", [`${marker} claim`]],
        ["/dashboard", []],
      ] as const) {
        const response = await page.goto(route);
        expect(response?.status(), route).toBe(200);
        await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(
          1,
        );
        // Check the server document too: hidden serialized load data is still a leak.
        const html = await response!.text();
        for (const ownMarker of ownMarkers)
          expect(html, route).toContain(ownMarker);
        for (const secret of [
          privateBike,
          privateService,
          privateProvider,
          privateNumber,
        ])
          expect(html, `${route}: foreign parent data`).not.toContain(secret);
      }
    } finally {
      try {
        await sql.begin(async (db) => {
          await db`delete from maintenance_photos where id = ${ids.photo} and owner_id = ${ownerId}`;
          await db`delete from maintenance_records where id = ${ids.service} and owner_id = ${ownerId}`;
          await db`delete from maintenance_plan_items where id = ${ids.plan} and owner_id = ${ownerId}`;
          await db`delete from tire_pressure_records where id = ${ids.pressure} and owner_id = ${ownerId}`;
          await db`delete from tire_records where id = ${ids.tire} and owner_id = ${ownerId}`;
          await db`delete from insurance_claims where id = ${ids.claim} and owner_id = ${ownerId}`;
          await db`delete from neon_auth."user" where id = ${foreignOwner}`;
        });
      } finally {
        await fixture.close();
      }
    }
  });
});
