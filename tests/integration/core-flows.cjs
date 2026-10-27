// Manual integration verifier for the disposable completion branch; never production.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const postgres = require("postgres");

require.extensions[".ts"] = (mod, filename) => {
  const result = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const output = result.outputText
    .replace(
      'require("@sveltejs/kit")',
      `require(${JSON.stringify(path.resolve(__dirname, "../../node_modules/@sveltejs/kit/src/exports/index.js"))})`,
    )
    .replace(
      /require\("\$(lib|server)\/([^"]+)"\)/g,
      (_, alias, name) =>
        `require(${JSON.stringify(path.resolve(__dirname, alias === "lib" ? "../../src/lib" : "../../src/lib/server", name))})`,
    );
  mod._compile(output, filename);
};
const {
  loadOwnershipCosts,
} = require("../../src/lib/server/domain/ownership-report.ts");
const {
  requireGarageMembership,
  canWriteGarageRecord,
} = require("../../src/lib/server/domain/garage-access.ts");
const { lockObjectOwner } = require("../../src/lib/server/db/owner-lock.ts");
const {
  syncMotorcycleOdometer,
} = require("../../src/lib/server/domain/odometer.ts");

async function main() {
  assert.equal(
    process.env.CORE_TEST_BRANCH,
    "br-twilight-hat-ac2ujtl1",
    "Explicit disposable branch opt-in required",
  );
  assert.notEqual(
    process.env.CORE_TEST_BRANCH,
    "br-lingering-darkness-acnan3z2",
    "Refusing production branch",
  );
  const connection = process.env.DATABASE_URL_UNPOOLED;
  assert.ok(
    connection &&
      new URL(connection).hostname.startsWith("ep-cold-paper-acyays6k."),
    "Unexpected database endpoint",
  );
  const db = postgres(connection, { ssl: "require", prepare: false, max: 3 });
  const owners = [randomUUID(), randomUUID()];
  const bike = randomUUID();
  const secondBike = randomUUID();
  const tire = randomUUID();
  const membership = randomUUID();
  const rollback = new Error("CORE_FIXTURE_ROLLBACK");
  try {
    await assert.rejects(
      db.begin(async (tx) => {
        for (const owner of owners)
          await tx`
        insert into neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        values (${owner}, 'Core flow fixture', ${`core-${owner}@example.invalid`}, true, now(), now())
      `;
        await tx`insert into motorcycles (id, owner_id, name, brand, model, year, current_odometer_km, purchase_date, purchase_odometer_km, purchase_price_cents, is_active)
        values (${bike}, ${owners[0]}, 'Fixture bike', 'Fixture', 'Test', 2026, 3000, '2026-01-01', 1000, 100000, true),
          (${secondBike}, ${owners[0]}, 'Second fixture', 'Fixture', 'Test', 2026, 8000, null, null, null, false)`;
        const baselineBike = randomUUID();
        const baselineFuel = randomUUID();
        await tx`insert into motorcycles (id, owner_id, name, brand, model, year, current_odometer_km, is_active)
          values (${baselineBike}, ${owners[0]}, 'Initial reading fixture', 'Fixture', 'Baseline', 2026, 1200, false)`;
        const [initialReading] =
          await tx`select odometer_override_km, odometer_override_at from motorcycles where id = ${baselineBike}`;
        assert.equal(initialReading.odometer_override_km, 1200);
        assert.ok(
          initialReading.odometer_override_at,
          "Creation reading has an observation time",
        );
        await tx`insert into fuel_records (id, owner_id, motorcycle_id, date, odometer_km, liters, total_price_cents)
          values (${baselineFuel}, ${owners[0]}, ${baselineBike}, current_date, 1300, 5, 1000)`;
        await syncMotorcycleOdometer(tx, owners[0], baselineBike, {
          strict: true,
        });
        assert.equal(
          (
            await tx`select current_odometer_km from motorcycles where id = ${baselineBike}`
          )[0].current_odometer_km,
          1300,
        );
        await tx`delete from fuel_records where id = ${baselineFuel}`;
        await syncMotorcycleOdometer(tx, owners[0], baselineBike, {
          strict: true,
        });
        assert.equal(
          (
            await tx`select current_odometer_km from motorcycles where id = ${baselineBike}`
          )[0].current_odometer_km,
          1200,
          "Deleting a later record preserves the original creation reading",
        );
        await tx`insert into tire_records (id, owner_id, motorcycle_id, position, brand_model, installed_at, installed_odometer_km, cost_cents, wear_percent)
        values (${tire}, ${owners[0]}, ${bike}, 'front', 'Fixture', current_date - 10, 1000, 1000, 50)`;
        const snapshot = async () => {
          const [row] =
            await tx`select wear_odometer_km from tire_records where id = ${tire}`;
          return row.wear_odometer_km;
        };
        assert.equal(await snapshot(), 3000);
        await tx`update motorcycles set current_odometer_km = 4000 where id = ${bike}`;
        await tx`update tire_records set wear_odometer_km = 999999, brand_model = 'Edited fixture' where id = ${tire}`;
        assert.equal(
          await snapshot(),
          3000,
          "Unchanged wear keeps its observation mileage",
        );
        await tx`update tire_records set wear_percent = 60 where id = ${tire}`;
        assert.equal(
          await snapshot(),
          4000,
          "New wear captures current mileage",
        );
        await tx`update tire_records set motorcycle_id = ${secondBike} where id = ${tire}`;
        assert.equal(
          await snapshot(),
          8000,
          "Moving a tire captures the destination mileage",
        );
        await tx`update tire_records set motorcycle_id = ${bike} where id = ${tire}`;

        await tx`insert into fuel_records (owner_id, motorcycle_id, date, odometer_km, liters, total_price_cents, currency)
        values (${owners[0]}, ${bike}, current_date - 1, 3900, 5, 2000, 'BRL'),
          (${owners[0]}, ${bike}, current_date + 10, 5000, 5, 900000, 'BRL'),
          (${owners[0]}, ${bike}, current_date - 1, 3900, 5, 800000, 'USD')`;
        await tx`insert into maintenance_records (owner_id, motorcycle_id, date, odometer_km, maintenance_type, cost_cents, currency)
        values (${owners[0]}, ${bike}, current_date - 2, 3800, 'Fixture service', 5000, 'BRL')`;
        const ownedReport = (await loadOwnershipCosts(tx, owners[0])).find(
          (row) => row.id === bike,
        );
        assert.equal(
          Number(ownedReport.fuel_cents),
          2000,
          "Future and foreign-currency costs are excluded",
        );
        assert.equal(ownedReport.totalCents, 108000);
        assert.equal(ownedReport.distanceKm, 3000);
        assert.equal(ownedReport.costPerKmCents, 36);
        assert.equal(
          (await loadOwnershipCosts(tx, owners[1])).length,
          0,
          "Other accounts cannot see ownership totals",
        );

        await tx`insert into garage_memberships (id, owner_id, member_id, role) values (${membership}, ${owners[0]}, ${owners[1]}, 'workshop')`;
        const access = await requireGarageMembership(tx, owners[1], membership);
        assert.equal(access.owner_id, owners[0]);
        assert.equal(canWriteGarageRecord(access.role, "maintenance"), true);
        assert.equal(canWriteGarageRecord(access.role, "fuel"), false);
        await assert.rejects(
          requireGarageMembership(tx, owners[0], membership),
          { status: 404 },
        );
        await tx`update garage_memberships set revoked_at = now() where id = ${membership}`;
        await assert.rejects(
          requireGarageMembership(tx, owners[1], membership),
          { status: 404 },
        );
        throw rollback;
      }),
      (cause) => cause === rollback,
    );
    const [remaining] =
      await db`select count(*)::int as count from neon_auth."user" where id in ${db(owners)}`;
    assert.equal(
      remaining.count,
      0,
      "Fixture transaction rolled back completely",
    );
    // Two garages can record one another's member as actor concurrently. Their
    // account mutexes must allow the opposite actor's FK KEY SHARE lock.
    for (const owner of owners)
      await db`insert into neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${owner}, 'Concurrent core fixture', ${`concurrent-${owner}@example.invalid`}, true, now(), now())`;
    try {
      let ready = 0;
      let release;
      const bothLocked = new Promise((resolve) => {
        release = resolve;
      });
      const write = (owner, actor) =>
        db.begin(async (tx) => {
          await tx`set local lock_timeout = '4s'`;
          await lockObjectOwner(tx, owner);
          if (++ready === 2) release();
          let deadline;
          try {
            await Promise.race([
              bothLocked,
              new Promise((_, reject) => {
                deadline = setTimeout(
                  () =>
                    reject(new Error("Account-lock test barrier timed out")),
                  10000,
                );
              }),
            ]);
          } finally {
            clearTimeout(deadline);
          }
          await tx`insert into garage_activity (owner_id, actor_id, record_table, record_id)
          values (${owner}, ${actor}, 'maintenance_records', ${randomUUID()})`;
          throw rollback;
        });
      const outcomes = await Promise.allSettled([
        write(owners[0], owners[1]),
        write(owners[1], owners[0]),
      ]);
      for (const outcome of outcomes)
        assert.ok(
          outcome.status === "rejected" && outcome.reason === rollback,
          "Cross-garage writes complete without FK deadlock",
        );
    } finally {
      await db`delete from neon_auth."user" where id in ${db(owners)}`;
    }
    console.log(
      "PASS: initial odometer baseline, tire snapshots, ownership totals, garage roles and revocation; fixtures rolled back",
    );
    console.log(
      "PASS: opposite garage actors do not deadlock; disposable account fixtures removed",
    );
  } finally {
    await db.end();
  }
}
main().catch((cause) => {
  console.error(cause.message);
  process.exitCode = 1;
});
