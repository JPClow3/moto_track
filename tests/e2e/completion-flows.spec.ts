import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  openDisposableDb,
  restoreActiveMotorcycles,
} from "./helpers/disposable-db";

test.describe("completed core flows", () => {
  // Multi-step journeys against a real Neon/Auth branch, like the other
  // authenticated suites; the 30s default is not enough under dev-mode Vite.
  test.describe.configure({ timeout: 300_000 });
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "Requires a disposable Neon/Auth environment.",
  );

  test("exports reminders and revokes a private calendar subscription", async ({
    page,
    playwright,
  }) => {
    await page.goto("/reports");
    const motorcycleId = await page
      .locator(
        'form[action="?/saveOwnershipBasis"] input[name="motorcycle_id"]',
      )
      .first()
      .inputValue();
    await page.goto("/reminders");
    await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
    const response = await page.request.post("/api/v1/reminders", {
      data: {
        motorcycle_id: motorcycleId,
        title: `Calendar E2E ${Date.now()}`,
        trigger_type: "by_date",
        reference_date: "2026-10-23",
        trigger_value_days: 1,
        is_active: true,
        send_email: false,
        send_push: false,
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const reminder = (await response.json()).result;
    try {
      await page.reload();
      await page
        .getByRole("button", { name: "Gerar link de assinatura", exact: true })
        .click();
      const input = page.getByLabel("URL privada do calendário");
      await expect(input).toBeVisible();
      const url = await input.inputValue();
      expect(url).toMatch(/\/calendar\/[a-f0-9]{64}\.ics$/);
      const anonymous = await playwright.request.newContext();
      try {
        const feed = await anonymous.get(url);
        expect(feed.status()).toBe(200);
        expect(feed.headers()["content-type"]).toContain("text/calendar");
        expect(feed.headers()["cache-control"]).toContain("no-store");
        expect(await feed.text()).toContain(reminder.title);
        const prefix = url.match(/\/([a-f0-9]{64})\.ics$/)![1].slice(0, 12);
        await page
          .locator("form")
          .filter({ hasText: prefix })
          .getByRole("button", { name: "Revogar link" })
          .click();
        await expect(
          page.locator("form").filter({ hasText: prefix }),
        ).toHaveCount(0);
        expect((await anonymous.get(url)).status()).toBe(404);
      } finally {
        await anonymous.dispose();
      }
      const download = await page.request.get("/reminders/calendar.ics");
      expect(download.status()).toBe(200);
      expect(await download.text()).toContain(reminder.title);
    } finally {
      await page.request.delete(`/api/v1/reminders?id=${reminder.id}`);
    }
  });

  test("saves acquisition mileage and shows the ownership cost in reports", async ({
    page,
  }) => {
    await page.goto("/reports");
    await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
    const section = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: "Custo total por km",
          exact: true,
        }),
      })
      .last();
    const card = section.locator("article").first();
    await card.locator("summary").click();
    await card.getByLabel("Data da compra", { exact: true }).fill("2026-01-01");
    await card.getByLabel("Odômetro na compra (km)", { exact: true }).fill("0");
    await card
      .getByLabel("Valor de compra (R$)", { exact: true })
      .fill("10000");
    await card.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      card.getByText("Custo total registrado", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      card.getByText("Custo total registrado", { exact: true }),
    ).toBeVisible();
    await expect(
      card.getByText("Distância desde a compra", { exact: true }),
    ).toBeVisible();
  });

  test("concurrent motorcycle creates share the last Free active slot", async ({
    page,
  }) => {
    const fixture = await openDisposableDb();
    const { sql, ownerId } = fixture;
    const names = [0, 1].map(() => `Concurrent bike ${randomUUID()}`);
    const active = await sql<
      Array<{ id: string }>
    >`select id from motorcycles where owner_id = ${ownerId} and is_active = true and deleted_at is null`;
    let reserved = false;
    try {
      const [subscription] = await sql<
        Array<{ plan: string }>
      >`select plan from subscription_profiles where owner_id = ${ownerId}`;
      test.skip(
        subscription?.plan !== "free",
        "This cap applies to the dedicated Free acceptance account.",
      );
      await sql`update motorcycles set is_active = false where owner_id = ${ownerId} and is_active = true and deleted_at is null`;
      reserved = true;
      await page.goto("/garage");
      const responses = await Promise.allSettled(
        names.map((name) =>
          page.request.post("/garage?/create", {
            headers: {
              origin: new URL(page.url()).origin,
              accept: "application/json",
            },
            form: {
              name,
              brand: "Acceptance",
              model: "Concurrent",
              year: String(new Date().getUTCFullYear()),
              current_odometer_km: "1200",
            },
          }),
        ),
      );
      const outcomes = await Promise.all(
        responses.map(async (result) => {
          expect(result.status).toBe("fulfilled");
          if (result.status !== "fulfilled") throw result.reason;
          expect(result.value.ok()).toBe(true);
          return (await result.value.json()) as {
            type: string;
            status: number;
          };
        }),
      );
      // SvelteKit encodes a form failure's status inside its JSON envelope;
      // the transport status for both success and failure is HTTP 200.
      expect(
        outcomes.filter(
          (result) => result.type === "success" && result.status === 200,
        ),
      ).toHaveLength(1);
      expect(
        outcomes.filter(
          (result) =>
            result.type === "failure" && [400, 403].includes(result.status),
        ),
      ).toHaveLength(1);
      const rows = await sql<
        Array<{ id: string; odometer_override_km: number }>
      >`
        select id, odometer_override_km from motorcycles where owner_id = ${ownerId} and name in ${sql(names)} and is_active = true
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0].odometer_override_km).toBe(1200);
    } finally {
      await sql.begin(async (db) => {
        await db`delete from motorcycles where owner_id = ${ownerId} and name in ${db(names)}`;
        if (reserved)
          await restoreActiveMotorcycles(
            db,
            ownerId,
            active.map((bike) => bike.id),
          );
      });
      await fixture.close();
    }
  });
});
