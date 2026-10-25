// Explicitly opt into the disposable completion branch. This verifier only
// loads .env.finish-app and always rolls its synthetic accounts/records back.
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const postgres = require("postgres");
async function verify() {
  if (
    process.env.WORKSHOP_BENCHMARK_TEST_BRANCH !== "br-dawn-glitter-ac0vy5bm"
  ) {
    throw new Error(
      "Explicit disposable workshop test branch opt-in is required",
    );
  }
  const config = Object.fromEntries(
    readFileSync(resolve(__dirname, "../../.env.finish-app"), "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const index = line.indexOf("=");
        return [
          line.slice(0, index),
          line.slice(index + 1).replace(/^(['"])(.*)\1$/, "$2"),
        ];
      }),
  );
  const connectionString = config.DATABASE_URL_UNPOOLED || config.DATABASE_URL;
  if (
    !connectionString ||
    !new URL(connectionString).hostname.endsWith(".neon.tech")
  ) {
    throw new Error("The disposable Neon connection is missing");
  }
  const db = postgres(connectionString, {
    ssl: "require",
    max: 1,
    prepare: false,
  });
  const token = randomUUID();
  const workshopKey = `workshop-fixture-${token}`;
  const workshopName = `Fixture workshop ${token}`;
  const serviceKey = `service-fixture-${token}`;
  const cityKey = `city-fixture-${token}`;
  const owners = Array.from({ length: 6 }, () => randomUUID());
  const rollback = new Error("WORKSHOP_TEST_ROLLBACK");
  const checks = [];

  try {
    await db.begin(async (tx) => {
      for (let index = 0; index < owners.length; index += 1) {
        await tx`insert into neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        values (${owners[index]}, 'Workshop benchmark fixture', ${`workshop-${token}-${index}@example.invalid`}, true, now(), now())`;
      }
      async function add(owner, labor, options = {}) {
        const record = randomUUID();
        const contribution = randomUUID();
        const workshop = options.workshop ?? workshopName;
        await tx`insert into maintenance_records (id, owner_id, workshop, maintenance_type, date, odometer_km, cost_cents, currency)
        values (${record}, ${owner}, ${workshop}, ${serviceKey}, current_date - 1, 1000, 20000, 'BRL')`;
        await tx`insert into workshop_benchmark_submission_guards (owner_id, record_id, contribution_id, source_workshop, source_service, serviced_on, source_total_cents, consented_at)
        values (${owner}, ${record}, ${contribution}, ${workshop}, ${serviceKey}, current_date - 1, 20000, now())`;
        await tx`insert into anonymous_workshop_benchmark_contributions (id, workshop_key, workshop_name, service_key, city_key, city_name, state_code, labor_cents)
        values (${contribution}, ${options.key ?? workshopKey}, ${workshop}, ${options.service ?? serviceKey}, ${options.city ?? cityKey}, 'Fixture city', ${options.state ?? "SP"}, ${labor})`;
        return { record, contribution };
      }
      const summary = () =>
        tx`select * from workshop_benchmark_summary(${serviceKey}, ${cityKey}, 'SP')`;
      const countObservation = async (id) => {
        const [row] =
          await tx`select count(*)::int as count from anonymous_workshop_benchmark_contributions where id = ${id}`;
        return row.count;
      };

      // Six records from one account still represent one contributor.
      for (const labor of [1000, 9000, 5000, 5000, 5000, 5000])
        await add(owners[0], labor);
      assert.equal((await summary()).length, 0);
      checks.push(
        "Repeated records cannot reach the five-account privacy floor",
      );
      for (const owner of owners.slice(1, 4)) await add(owner, 1000);
      assert.equal((await summary()).length, 0);

      // An account in another workshop, service or region cannot unlock this one.
      await add(owners[4], 1000, {
        workshop: "Another fixture workshop",
        key: `other-${token}`,
      });
      await add(owners[5], 1000, { city: `other-city-${token}` });
      await add(owners[5], 1000, { state: "RJ" });
      await add(owners[5], 1000, { service: `other-service-${token}` });
      assert.equal((await summary()).length, 0);
      checks.push("Workshop, service, city and state cohorts remain isolated");

      const fifth = await add(owners[4], 1000);
      const [result] = await summary();
      assert.equal(result.sample_size, 5);
      // Account zero averages 5000, the other four 1000 each: (5000+4000)/5.
      assert.equal(Number(result.average_labor_cents), 1800);
      assert.deepEqual(
        Object.keys(result).sort(),
        [
          "workshop_key",
          "workshop_name",
          "sample_size",
          "average_labor_cents",
        ].sort(),
      );
      checks.push(
        "Five accounts reveal only the equal-account-weight aggregate (1800 cents)",
      );

      await tx`delete from workshop_benchmark_submission_guards where owner_id = ${owners[4]} and record_id = ${fifth.record}`;
      assert.equal(await countObservation(fifth.contribution), 0);
      assert.equal((await summary()).length, 0);
      checks.push(
        "Withdrawal cascades the anonymous row and restores suppression below five",
      );

      const replacement = await add(owners[4], 1000);
      assert.equal((await summary()).length, 1);
      await tx`update maintenance_records set cost_cents = 19000 where id = ${replacement.record}`;
      assert.equal((await summary()).length, 0);
      await tx`update maintenance_records set cost_cents = 20000 where id = ${replacement.record}`;
      assert.equal((await summary()).length, 1);
      checks.push(
        "Changed source totals invalidate consent snapshots before aggregation",
      );

      await tx`delete from maintenance_records where id = ${replacement.record} and owner_id = ${owners[4]}`;
      assert.equal(await countObservation(replacement.contribution), 0);
      assert.equal((await summary()).length, 0);
      checks.push(
        "Source deletion cascades through guard and anonymous observation",
      );

      const accountDeletion = await add(owners[4], 1000);
      assert.equal((await summary()).length, 1);
      await tx`delete from neon_auth."user" where id = ${owners[4]}`;
      assert.equal(await countObservation(accountDeletion.contribution), 0);
      assert.equal((await summary()).length, 0);
      checks.push(
        "Account deletion removes observations and distinct-account eligibility",
      );
      throw rollback;
    });
  } catch (err) {
    if (err !== rollback) throw err;
    const [remainingAccounts] = await db`
      select count(*)::int as count from neon_auth."user"
      where id in ${db(owners)}
    `;
    const [remainingObservations] = await db`
      select count(*)::int as count from anonymous_workshop_benchmark_contributions
      where workshop_key in (${workshopKey}, ${`other-${token}`})
    `;
    assert.equal(remainingAccounts.count, 0);
    assert.equal(remainingObservations.count, 0);
    checks.push(
      "Standalone readback confirms no synthetic accounts or observations remain after rollback",
    );
  } finally {
    await db.end();
  }
  console.log(JSON.stringify({ ok: true, rolledBack: true, checks }, null, 2));
}
verify().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
