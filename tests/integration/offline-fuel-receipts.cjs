// Explicit disposable-branch verifier. Every fixture is rolled back.
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const postgres = require("postgres");
const ts = require("typescript");

async function verify() {
  if (process.env.FUEL_SUBMISSION_TEST_BRANCH !== "br-dawn-glitter-ac0vy5bm")
    throw new Error("Explicit isolated fuel-receipt branch opt-in required");
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
  const connection = config.DATABASE_URL_UNPOOLED || config.DATABASE_URL;
  const hostname = connection && new URL(connection).hostname;
  if (
    !hostname?.endsWith(".neon.tech") ||
    hostname !== process.env.FUEL_SUBMISSION_TEST_HOST
  )
    throw new Error("Explicit matching isolated Neon host required");
  const sourcePath = resolve(
    __dirname,
    "../../src/lib/server/domain/offline-fuel-replay.ts",
  );
  const compiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const helper = new Module(sourcePath, module);
  helper._compile(compiled, sourcePath);
  const {
    offlineFuelFingerprint,
    resolveOfflineFuelSubmission,
    acceptOfflineFuelSubmission,
    OfflineFuelConflict,
  } = helper.exports;
  const db = postgres(connection, {
    ssl: "require",
    prepare: false,
    max: 1,
    connect_timeout: 10,
  });
  const owners = [randomUUID(), randomUUID()];
  const ids = Array.from({ length: 6 }, () => randomUUID());
  const rollback = new Error("FUEL_RECEIPT_FIXTURE_ROLLBACK");
  const checks = [];
  function payload(id, owner) {
    return {
      id,
      owner_id: owner,
      motorcycle_id: null,
      station_id: null,
      fuel_grade_id: null,
      date: "2026-10-22",
      odometer_km: 1000,
      liters: 10,
      total_price_cents: 6000,
      price_per_liter_millicents: 600000,
      fuel_type: "gasoline",
      tank_full: true,
      station_name: "Private fixture station",
      notes: "PRIVATE-FUEL-NOTE",
      receipt_file_key: null,
    };
  }
  try {
    await db.begin(async (tx) => {
      for (const owner of owners)
        await tx`insert into neon_auth."user" (id,name,email,"emailVerified","createdAt","updatedAt") values (${owner}, 'Fuel receipt fixture', ${`fuel-${owner}@example.invalid`}, true, now(), now())`;
      const first = payload(ids[0], owners[0]);
      const fingerprint = await offlineFuelFingerprint(first);
      await tx`select id from neon_auth."user" where id = ${owners[0]} for no key update`;
      assert.equal(
        await resolveOfflineFuelSubmission(tx, owners[0], first, fingerprint),
        "new",
      );
      await tx`insert into fuel_records ${tx(first)}`;
      await acceptOfflineFuelSubmission(tx, owners[0], first.id, fingerprint);
      assert.equal(
        await resolveOfflineFuelSubmission(tx, owners[0], first, fingerprint),
        "accepted",
      );
      checks.push("original and response-lost retry share one receipt");

      await tx`delete from fuel_records where id = ${first.id}`;
      const [deleted] =
        await tx`select * from offline_fuel_submissions where id = ${first.id}`;
      assert.equal(deleted.payload_fingerprint, fingerprint);
      assert.ok(deleted.deleted_at);
      assert.equal(JSON.stringify(deleted).includes(first.notes), false);
      assert.equal(JSON.stringify(deleted).includes(first.station_name), false);
      assert.equal(
        await resolveOfflineFuelSubmission(tx, owners[0], first, fingerprint),
        "accepted",
      );
      const [absent] =
        await tx`select count(*)::int as count from fuel_records where id = ${first.id}`;
      assert.equal(absent.count, 0);
      checks.push(
        "delete retains digest and retry never resurrects the visible record",
      );
      const changed = { ...first, total_price_cents: 6100 };
      await assert.rejects(
        async () =>
          resolveOfflineFuelSubmission(
            tx,
            owners[0],
            changed,
            await offlineFuelFingerprint(changed),
          ),
        OfflineFuelConflict,
      );
      await assert.rejects(
        () => resolveOfflineFuelSubmission(tx, owners[1], first, fingerprint),
        OfflineFuelConflict,
      );
      checks.push("changed payload and another owner get a generic conflict");

      const legacy = payload(ids[1], owners[0]);
      await tx`insert into fuel_records ${tx(legacy)}`;
      await tx`delete from fuel_records where id = ${legacy.id}`;
      const [unprovable] =
        await tx`select owner_id,payload_fingerprint,deleted_at from offline_fuel_submissions where id = ${legacy.id}`;
      assert.equal(unprovable.payload_fingerprint, null);
      assert.ok(unprovable.deleted_at);
      await assert.rejects(
        async () =>
          resolveOfflineFuelSubmission(
            tx,
            owners[0],
            legacy,
            await offlineFuelFingerprint(legacy),
          ),
        OfflineFuelConflict,
      );
      checks.push(
        "deleted legacy records create a NULL digest tombstone and remain blocked",
      );

      const preProtocol = payload(ids[2], owners[0]);
      await tx`insert into fuel_records ${tx(preProtocol)}`;
      const oldFingerprint = await offlineFuelFingerprint(preProtocol);
      assert.equal(
        await resolveOfflineFuelSubmission(
          tx,
          owners[0],
          preProtocol,
          oldFingerprint,
        ),
        "accepted",
      );
      await tx`delete from fuel_records where id = ${preProtocol.id}`;
      assert.equal(
        await resolveOfflineFuelSubmission(
          tx,
          owners[0],
          preProtocol,
          oldFingerprint,
        ),
        "accepted",
      );
      checks.push(
        "existing matching pre-protocol record gains a durable receipt before acknowledgement",
      );

      const effectFailure = new Error("INJECTED_POST_INSERT_FAILURE");
      const failed = payload(ids[3], owners[0]);
      try {
        await tx.savepoint(async (sub) => {
          await sub`insert into fuel_records ${sub(failed)}`;
          await acceptOfflineFuelSubmission(
            sub,
            owners[0],
            failed.id,
            await offlineFuelFingerprint(failed),
          );
          throw effectFailure;
        });
      } catch (cause) {
        if (cause !== effectFailure) throw cause;
      }
      const [rolledBack] =
        await tx`select (select count(*) from fuel_records where id = ${failed.id})::int as records, (select count(*) from offline_fuel_submissions where id = ${failed.id})::int as receipts`;
      assert.deepEqual(rolledBack, { records: 0, receipts: 0 });
      checks.push(
        "record and receipt roll back together after injected transaction failure",
      );

      const cascading = payload(ids[4], owners[1]);
      const cascadingLegacy = payload(ids[5], owners[1]);
      await tx`insert into fuel_records ${tx(cascading)}`;
      await acceptOfflineFuelSubmission(
        tx,
        owners[1],
        cascading.id,
        await offlineFuelFingerprint(cascading),
      );
      await tx`insert into fuel_records ${tx(cascadingLegacy)}`;
      await tx`delete from neon_auth."user" where id = ${owners[1]}`;
      const [cascade] =
        await tx`select (select count(*) from fuel_records where owner_id = ${owners[1]})::int as records, (select count(*) from offline_fuel_submissions where owner_id = ${owners[1]})::int as receipts`;
      assert.deepEqual(cascade, { records: 0, receipts: 0 });
      checks.push(
        "account CASCADE removes hashed and legacy rows without trigger FK failures",
      );
      throw rollback;
    });
  } catch (cause) {
    if (cause !== rollback) throw cause;
  } finally {
    try {
      const [state] =
        await db`select (select count(*) from neon_auth."user" where id in ${db(owners)})::int as accounts, (select count(*) from offline_fuel_submissions where id in ${db(ids)})::int as receipts, (select count(*) from fuel_records where id in ${db(ids)})::int as records`;
      assert.deepEqual(state, { accounts: 0, receipts: 0, records: 0 });
    } finally {
      await db.end({ timeout: 5 });
    }
  }
  console.log(JSON.stringify({ passed: true, checks, rolledBack: true }));
}
verify().catch((cause) => {
  console.error(
    cause instanceof Error ? cause.message : "Fuel receipt verification failed",
  );
  process.exitCode = 1;
});
