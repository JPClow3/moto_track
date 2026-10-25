import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { openDisposableDb } from "./helpers/disposable-db";

test.describe("shared garage acceptance", () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "Requires the dedicated disposable authenticated account.",
  );

  test("creates and revokes an invitation, accepts a verified workshop invitation, and enforces revocation", async ({
    page,
  }) => {
    const fixture = await openDisposableDb();
    const { sql, ownerId } = fixture;
    const synthetic = randomUUID();
    const email = `garage-e2e-${synthetic}@example.invalid`;
    const bike = randomUUID();
    const invitation = randomUUID();
    const token = randomBytes(32).toString("hex");
    const description = `Shared acceptance ${randomUUID()}`;
    try {
      await sql`insert into neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        values (${synthetic}, 'Shared garage fixture', ${email}, true, now(), now())`;
      await sql`insert into profiles (id, email, full_name) values (${synthetic}, ${email}, 'Shared garage fixture') on conflict (id) do nothing`;
      await sql`insert into motorcycles (id, owner_id, name, brand, model, year, current_odometer_km, is_active)
        values (${bike}, ${synthetic}, 'Workshop acceptance bike', 'Fixture', 'Shared', 2026, 1000, true)`;

      await page.goto("/garage/access");
      await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
      const inviteForm = page.locator('form[action="?/invite"]');
      await inviteForm.locator('[name="email"]').fill(email);
      await inviteForm.locator('[name="role"]').selectOption("workshop");
      await inviteForm.getByRole("button", { name: /Gerar|Generate/i }).click();
      await expect(page.locator("#sharing-url")).toHaveValue(
        /\/garage\/invite\/[a-f0-9]{64}$/,
      );
      const outgoing = page
        .locator('form[action="?/revokeInvitation"]')
        .filter({ hasText: email });
      const outgoingId = await outgoing.locator('[name="id"]').inputValue();
      await outgoing.getByRole("button").click();
      await expect(outgoing).toHaveCount(0);
      expect(
        (
          await sql`select revoked_at is not null as revoked from garage_invitations where id = ${outgoingId} and owner_id = ${ownerId}`
        )[0].revoked,
      ).toBe(true);

      // Verification is a disposable DB fixture; no mail is sent.
      await sql`insert into garage_invitations (id, owner_id, invited_email, role, token_hash, token_prefix, expires_at)
        values (${invitation}, ${synthetic}, ${process.env.E2E_USER_EMAIL!.toLowerCase()}, 'workshop',
          ${createHash("sha256").update(token).digest("hex")}, ${token.slice(0, 12)}, now() + interval '1 hour')`;
      await page.goto(`/garage/invite/${token}`);
      const accept = page.locator('form[action="?/accept"] button');
      await sql`update neon_auth."user" set "emailVerified" = false where id = ${ownerId}`;
      await page.reload();
      await expect(accept).toBeDisabled();
      const unverified = await page.request.post(
        `/garage/invite/${token}?/accept`,
        {
          headers: {
            origin: new URL(page.url()).origin,
            accept: "application/json",
          },
          form: {},
        },
      );
      expect(await unverified.json()).toMatchObject({
        type: "failure",
        status: 403,
      });
      expect(
        Number(
          (
            await sql`select count(*)::int as n from garage_memberships where owner_id = ${synthetic} and member_id = ${ownerId}`
          )[0].n,
        ),
      ).toBe(0);
      await sql`update neon_auth."user" set "emailVerified" = true where id = ${ownerId}`;
      await page.reload();
      await expect(accept).toBeEnabled();
      await accept.click();
      await expect(page).toHaveURL(/\/garage\/shared\/[a-f0-9-]+$/);
      const accessId = new URL(page.url()).pathname.split("/").at(-1)!;
      expect(
        (
          await sql`select accepted_by from garage_invitations where id = ${invitation}`
        )[0].accepted_by,
      ).toBe(ownerId);
      await expect(
        page.getByRole("heading", {
          name: "Workshop acceptance bike",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.locator('#shared-feature option[value="fuel"]'),
      ).toHaveCount(0);
      await page.locator("#shared-mileage").fill("1200");
      await page.locator("#shared-service").fill("Workshop acceptance service");
      await page.locator("#shared-cost").fill("15");
      await page.locator("#shared-description").fill(description);
      await page
        .locator('form[action="?/record"] button[type="submit"]')
        .click();
      await expect
        .poll(async () =>
          Number(
            (
              await sql`select count(*)::int as n from maintenance_records
        where owner_id = ${synthetic} and motorcycle_id = ${bike} and description = ${description}`
            )[0].n,
          ),
        )
        .toBe(1);
      expect(
        (
          await sql`select actor_id from garage_activity where owner_id = ${synthetic} and membership_id = ${accessId}`
        )[0].actor_id,
      ).toBe(ownerId);

      const deniedFuel = await page.request.post(
        `/garage/shared/${accessId}?/record`,
        {
          headers: {
            origin: new URL(page.url()).origin,
            accept: "application/json",
          },
          form: {
            feature: "fuel",
            motorcycle_id: bike,
            date: new Date().toISOString().slice(0, 10),
            odometer_km: "1300",
            liters: "5",
            total_price_cents: "30",
            station_name: description,
          },
        },
      );
      expect(await deniedFuel.json()).toMatchObject({
        type: "failure",
        status: 403,
      });
      expect(
        Number(
          (
            await sql`select count(*)::int as n from fuel_records where owner_id = ${synthetic} and motorcycle_id = ${bike}`
          )[0].n,
        ),
      ).toBe(0);

      await sql`update garage_memberships set revoked_at = now() where id = ${accessId} and owner_id = ${synthetic}`;
      expect((await page.goto(`/garage/shared/${accessId}`))?.status()).toBe(
        404,
      );
      const deniedWrite = await page.request.post(
        `/garage/shared/${accessId}?/record`,
        {
          headers: {
            origin: new URL(page.url()).origin,
            accept: "application/json",
          },
          form: {
            feature: "maintenance",
            motorcycle_id: bike,
            date: new Date().toISOString().slice(0, 10),
            odometer_km: "1400",
            maintenance_type: "Denied after revocation",
            cost_cents: "0",
          },
        },
      );
      expect(await deniedWrite.json()).toMatchObject({
        type: "failure",
        status: 404,
      });
      expect(
        Number(
          (
            await sql`select count(*)::int as n from maintenance_records where owner_id = ${synthetic} and motorcycle_id = ${bike}`
          )[0].n,
        ),
      ).toBe(1);
    } finally {
      try {
        await sql`update neon_auth."user" set "emailVerified" = ${fixture.emailVerified} where id = ${ownerId}`;
        await sql`delete from garage_invitations where owner_id = ${ownerId} and invited_email = ${email}`;
        await sql`delete from neon_auth."user" where id = ${synthetic} and email = ${email}`;
      } finally {
        await fixture.close();
      }
    }
  });
});
