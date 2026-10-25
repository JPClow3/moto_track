import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "devalue";
import { expect, test, type Page } from "@playwright/test";
import { openDisposableDb } from "./helpers/disposable-db";
import {
  readLocalFuelDrafts,
  seedLocalFuelDrafts,
  type LocalFuelDraft,
} from "./helpers/offline-queue";

test.describe("offline fill-up acceptance on the isolated branch", () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "Requires the dedicated disposable Neon/Auth account.",
  );

  async function ready(page: Page) {
    await page.goto("/offline");
    await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
    await expect
      .poll(
        () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
        { timeout: 20_000 },
      )
      .toBe(true);
  }
  function draft(ownerId?: string): LocalFuelDraft {
    return {
      id: randomUUID(),
      ownerId,
      createdAt: new Date().toISOString(),
      values: {
        date: new Date().toISOString().slice(0, 10),
        odometer_km: "1000",
        liters: "10",
        total_price: "60.00",
        price_per_liter: "6.000",
        tank_full: "true",
        notes: "Disposable browser acceptance",
      },
    };
  }

  for (const deletedAfterCommit of [false, true])
    test(`a real commit and lost response ${deletedAfterCommit ? "remain acknowledged after user deletion without resurrection" : "replay the original ID exactly once"}`, async ({
      page,
      context,
    }) => {
      const fixture = await openDisposableDb();
      const queued = draft(fixture.ownerId);
      let calls = 0;
      let realAcknowledgement: unknown;
      // The action name contains a slash in its query. A glob ending in `?*`
      // cannot match it because Playwright's single `*` never crosses `/`.
      // Context routing also observes the service worker's network request.
      const pattern = (url: URL) =>
        url.pathname === "/fuel" && url.search === "?/createRecord";
      try {
        await ready(page);
        await context.route(pattern, async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          expect(route.request().serviceWorker()).not.toBeNull();
          const response = await route.fetch();
          const wire = await response.json();
          expect(wire.type).toBe("success");
          realAcknowledgement = parse(wire.data);
          calls++;
          if (calls === 1) await route.abort("failed");
          else await route.fulfill({ response });
        });
        await seedLocalFuelDrafts(page, [queued]);
        await page
          .getByRole("button", {
            name: /Atualizar rascunhos locais|Refresh local drafts/,
          })
          .click();
        await page
          .getByRole("button", {
            name: /Enviar rascunhos desta conta|Send drafts for this account/,
          })
          .click();
        await expect
          .poll(async () => {
            const [row] = await fixture.sql<
              Array<{ count: number }>
            >`select count(*)::int as count from fuel_records where id = ${queued.id} and owner_id = ${fixture.ownerId}`;
            return row.count;
          })
          .toBe(1);
        await expect
          .poll(
            async () =>
              (await readLocalFuelDrafts(page)).find(
                (entry) => entry.id === queued.id,
              )?.status,
          )
          .toBe("network");
        expect(calls).toBe(1);
        expect(realAcknowledgement).toEqual({
          ok: true,
          offlineSubmissionId: queued.id,
        });
        if (deletedAfterCommit) {
          const deleted = await page.request.post("/fuel?/deleteRecord", {
            form: { id: queued.id },
            headers: { accept: "application/json" },
          });
          expect((await deleted.json()).type).toBe("success");
          const [receipt] = await fixture.sql<
            Array<{ payload_fingerprint: string; deleted_at: unknown }>
          >`select payload_fingerprint, deleted_at from offline_fuel_submissions where id = ${queued.id} and owner_id = ${fixture.ownerId}`;
          expect(receipt.payload_fingerprint).toMatch(/^[0-9a-f]{64}$/);
          expect(receipt.deleted_at).not.toBeNull();
        }
        await page
          .getByRole("button", {
            name: /Enviar rascunhos desta conta|Send drafts for this account/,
          })
          .click();
        await expect
          .poll(async () =>
            (await readLocalFuelDrafts(page)).some(
              (entry) => entry.id === queued.id,
            ),
          )
          .toBe(false);
        const [row] = await fixture.sql<
          Array<{ count: number }>
        >`select count(*)::int as count from fuel_records where id = ${queued.id}`;
        expect(row.count).toBe(deletedAfterCommit ? 0 : 1);
        expect(calls).toBe(2);
      } finally {
        try {
          await context.unroute(pattern);
          await fixture.sql`delete from fuel_records where id = ${queued.id} and owner_id = ${fixture.ownerId}`;
          await fixture.sql`delete from offline_fuel_submissions where id = ${queued.id} and owner_id = ${fixture.ownerId}`;
        } finally {
          await fixture.close();
        }
      }
    });

  test("expired auth retains drafts; unknown and foreign drafts never POST; explicit legacy review preserves the ID", async ({
    page,
    context,
  }) => {
    const fixture = await openDisposableDb();
    const foreignOwner = randomUUID();
    const current = draft(fixture.ownerId),
      legacy = draft(),
      foreign = draft(foreignOwner),
      missing = draft(fixture.ownerId);
    missing.values.receipt_file = "missing-receipt.jpg";
    legacy.values.notes = '<img src=x onerror="window.unsafeDraft=true">';
    legacy.values.station_id = randomUUID();
    const ids = [current.id, legacy.id, foreign.id, missing.id];
    const posts: string[] = [];
    const cookies = await context.cookies();
    context.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("/fuel?/createRecord")
      )
        posts.push(request.postData() || "");
    });
    try {
      await fixture.sql`insert into neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values (${foreignOwner}, 'Offline fixture', ${`offline-${foreignOwner}@example.invalid`}, true, now(), now())`;
      await ready(page);
      await seedLocalFuelDrafts(page, [current, legacy, foreign, missing]);
      await page
        .getByRole("button", {
          name: /Atualizar rascunhos locais|Refresh local drafts/,
        })
        .click();
      await context.clearCookies({ name: "mt_session" });
      const status = await page.request.get("/api/pwa/status");
      expect(await status.json()).toMatchObject({
        authenticated: false,
        userId: null,
      });
      await page
        .getByRole("button", {
          name: /Enviar rascunhos desta conta|Send drafts for this account/,
        })
        .click();
      await expect
        .poll(
          async () =>
            (await readLocalFuelDrafts(page)).find(
              (entry) => entry.id === current.id,
            )?.status,
        )
        .toBe("authentication");
      expect(posts).toEqual([]);
      await context.addCookies(cookies);
      await page.reload();
      await expect
        .poll(async () =>
          (await readLocalFuelDrafts(page)).some(
            (entry) => entry.id === current.id,
          ),
        )
        .toBe(false);
      await expect
        .poll(
          async () =>
            (await readLocalFuelDrafts(page)).find(
              (entry) => entry.id === foreign.id,
            )?.status,
        )
        .toBe("other-owner");
      expect(
        posts.some(
          (body) =>
            body.includes(foreign.id) ||
            body.includes(legacy.id) ||
            body.includes(missing.id),
        ),
      ).toBe(false);
      const [foreignCount] = await fixture.sql<
        Array<{ count: number }>
      >`select count(*)::int as count from fuel_records where id in ${fixture.sql([foreign.id, legacy.id, missing.id])}`;
      expect(foreignCount.count).toBe(0);
      const legacyCard = page.locator(`[data-draft-id="${legacy.id}"]`);
      await expect(legacyCard).toBeVisible();
      const downloadEvent = page.waitForEvent("download");
      await legacyCard
        .getByRole("button", {
          name: /Exportar rascunho JSON|Export draft JSON/,
        })
        .click();
      const downloaded = await downloadEvent;
      const exported = JSON.parse(
        await readFile((await downloaded.path())!, "utf8"),
      );
      expect(exported.drafts[0].id).toBe(legacy.id);
      expect(exported.drafts[0].ownerId).toBeUndefined();
      expect(exported.drafts[0].values.notes).toBe(legacy.values.notes);
      await legacyCard.locator("summary").click();
      await expect(legacyCard.locator("img")).toHaveCount(0);
      await legacyCard
        .getByRole("button", { name: /Revisar e importar|Review and import/ })
        .click();
      expect(
        (await readLocalFuelDrafts(page)).find(
          (entry) => entry.id === legacy.id,
        )?.ownerId,
      ).toBeUndefined();
      await legacyCard.locator('input[name="review_consent"]').check();
      await legacyCard
        .getByRole("button", { name: /Revisar e importar|Review and import/ })
        .click();
      await expect
        .poll(async () =>
          (await readLocalFuelDrafts(page)).some(
            (entry) => entry.id === legacy.id,
          ),
        )
        .toBe(false);
      const [saved] = await fixture.sql<
        Array<{ owner_id: string; station_id: string | null }>
      >`select owner_id, station_id from fuel_records where id = ${legacy.id}`;
      expect(saved).toEqual({ owner_id: fixture.ownerId, station_id: null });
      await expect(
        page
          .locator(`[data-draft-id="${missing.id}"]`)
          .getByText(/comprovante indisponível|unavailable receipt/),
      ).toBeVisible();
      const foreignCard = page.locator(`[data-draft-id="${foreign.id}"]`);
      await expect(
        foreignCard.locator('input[name="review_consent"]'),
      ).toHaveCount(0);
      context.once("dialog", (dialog) => dialog.accept());
      await foreignCard
        .getByRole("button", {
          name: /Descartar rascunho local|Discard local draft/,
        })
        .click();
      await expect(foreignCard).toHaveCount(0);
    } finally {
      try {
        await context.addCookies(cookies);
        await fixture.sql`delete from fuel_records where id in ${fixture.sql(ids)} and owner_id in ${fixture.sql([fixture.ownerId, foreignOwner])}`;
        await fixture.sql`delete from offline_fuel_submissions where id in ${fixture.sql(ids)} and owner_id in ${fixture.sql([fixture.ownerId, foreignOwner])}`;
        await fixture.sql`delete from neon_auth."user" where id = ${foreignOwner}`;
      } finally {
        await fixture.close();
      }
    }
  });
});
