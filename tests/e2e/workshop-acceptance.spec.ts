import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { openDisposableDb } from "./helpers/disposable-db";

test.describe("workshop opt-in acceptance on the isolated branch", () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "Requires the dedicated disposable Neon/Auth account.",
  );

  test("five distinct accounts unlock the aggregate, repeated records keep equal weight, withdrawal hides it again", async ({
    page,
    context,
    baseURL,
  }) => {
    const fixture = await openDisposableDb();
    const token = randomUUID();
    const owners = Array.from({ length: 4 }, () => randomUUID());
    const ownerRecords = [randomUUID(), randomUUID()];
    const workshop = `E2E workshop ${token}`,
      service = `E2E inspection ${token}`,
      city = `E2E city ${token}`;
    const key = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    try {
      const [day] = await fixture.sql<
        Array<{ date: string }>
      >`select to_char(current_date - 1, 'YYYY-MM-DD') as date`;
      await fixture.sql.begin(async (sql) => {
        for (const [index, owner] of owners.entries()) {
          await sql`insert into neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values (${owner}, 'Workshop browser fixture', ${`workshop-${owner}@example.invalid`}, true, now(), now())`;
          const record = randomUUID(),
            contribution = randomUUID();
          await sql`insert into maintenance_records (id, owner_id, workshop, maintenance_type, date, odometer_km, cost_cents, currency) values (${record}, ${owner}, ${workshop}, ${service}, ${day.date}, 1000, 20000, 'BRL')`;
          await sql`insert into workshop_benchmark_submission_guards (owner_id, record_id, contribution_id, source_workshop, source_service, serviced_on, source_total_cents, consented_at) values (${owner}, ${record}, ${contribution}, ${workshop}, ${service}, ${day.date}, 20000, now())`;
          await sql`insert into anonymous_workshop_benchmark_contributions (id, workshop_key, workshop_name, service_key, city_key, city_name, state_code, labor_cents) values (${contribution}, ${key(workshop)}, ${workshop}, ${key(service)}, ${key(city)}, ${city}, 'SP', ${(index + 1) * 1000})`;
        }
        for (const record of ownerRecords)
          await sql`insert into maintenance_records (id, owner_id, workshop, maintenance_type, date, odometer_km, cost_cents, currency) values (${record}, ${fixture.ownerId}, ${workshop}, ${service}, ${day.date}, 1000, 20000, 'BRL')`;
      });
      await context.addCookies([
        {
          name: "locale",
          value: "en",
          url: baseURL || "http://localhost:5187",
        },
      ]);
      await page.goto(
        `/maintenance/workshops?${new URLSearchParams({ service, city, state: "SP" })}`,
      );
      await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
      await expect(
        page.getByRole("heading", { name: "Workshop comparison", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          /No workshop has contributions from five distinct accounts/,
        ),
      ).toBeVisible();
      await expect(page.getByRole("table")).toHaveCount(0);
      const contribute = async (recordId: string, labor: string) => {
        await page.locator("#workshop-record").selectOption(recordId);
        await page.locator("#workshop-labor").fill(labor);
        await page.locator("#workshop-city").fill(city);
        await page.locator("#workshop-state").selectOption("SP");
        await page.locator("#workshop-consent").check();
        await page
          .getByRole("button", { name: "Confirm sharing", exact: true })
          .click();
        await expect(
          page.getByRole("status").filter({ hasText: "Contribution saved." }),
        ).toBeVisible();
      };
      await contribute(ownerRecords[0], "50.00");
      const aggregate = page
        .getByRole("table")
        .locator("tbody tr")
        .filter({ hasText: workshop });
      await expect(aggregate.getByRole("cell").nth(1)).toContainText("30.00");
      await expect(aggregate.getByRole("cell").nth(2)).toHaveText("5");
      await contribute(ownerRecords[1], "100.00");
      await expect(aggregate.getByRole("cell").nth(1)).toContainText("35.00");
      await expect(aggregate.getByRole("cell").nth(2)).toHaveText("5");
      const html = await page.content();
      for (const owner of owners) expect(html).not.toContain(owner);
      const contributions = await fixture.sql<
        Array<{ contribution_id: string }>
      >`select contribution_id from workshop_benchmark_submission_guards where owner_id = ${fixture.ownerId} and record_id in ${fixture.sql(ownerRecords)}`;
      const withdraw = async (recordId: string) => {
        const form = page.locator('form[action="?/withdraw"]').filter({
          has: page.locator(`input[name="record_id"][value="${recordId}"]`),
        });
        await form
          .getByRole("button", { name: "Withdraw contribution", exact: true })
          .click();
        await expect(form).toHaveCount(0);
      };
      await withdraw(ownerRecords[1]);
      await expect(aggregate.getByRole("cell").nth(1)).toContainText("30.00");
      await withdraw(ownerRecords[0]);
      await expect(page.getByRole("table")).toHaveCount(0);
      await expect(
        page.getByText(
          /No workshop has contributions from five distinct accounts/,
        ),
      ).toBeVisible();
      const [remaining] = await fixture.sql<
        Array<{ count: number }>
      >`select count(*)::int as count from anonymous_workshop_benchmark_contributions where id in ${fixture.sql(contributions.map((row) => row.contribution_id))}`;
      expect(remaining.count).toBe(0);
    } finally {
      await fixture.sql`delete from maintenance_records where owner_id = ${fixture.ownerId} and id in ${fixture.sql(ownerRecords)}`;
      await fixture.sql`delete from neon_auth."user" where id in ${fixture.sql(owners)}`;
      await fixture.close();
    }
  });
});
