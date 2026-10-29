// Manual verifier for disposable fixtures in the completion branch only.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const postgres = require("postgres");
const ts = require("typescript");

require.extensions[".ts"] = (mod, filename) => {
  const result = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  mod._compile(result.outputText, filename);
};

const {
  lockAccountActor,
  lockObjectOwner,
} = require("../../src/lib/server/db/owner-lock.ts");
const rollback = new Error("GARAGE_CONCURRENCY_FIXTURE_ROLLBACK");

function signal() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function deadline(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          12000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function outcome(promise) {
  return promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason }),
  );
}

function assertRollback(result, label) {
  assert.ok(
    result.status === "rejected" && result.reason === rollback,
    `${label}: expected fixture rollback, received ${result.reason?.code ?? result.reason?.message ?? result.status}`,
  );
}

async function waitForBlock(db, waiter, blocker) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const [row] = await db`
      select pg_blocking_pids(${waiter}::int) as blockers
    `;
    if (row.blockers.includes(blocker)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Expected account deletion to wait for the shared writer");
}

async function transactionSettings(tx) {
  await tx`set local lock_timeout = '8s'`;
  await tx`set local statement_timeout = '15s'`;
}

async function verifyDeletion(db, ids, membershipId, target) {
  const writerReady = signal();
  const deletionReady = signal();
  const releaseWriter = signal();
  let writerPid;
  let deletionPid;
  const writer = outcome(
    db.begin(async (tx) => {
      await transactionSettings(tx);
      writerPid = (await tx`select pg_backend_pid() as pid`)[0].pid;
      await lockAccountActor(tx, ids[1]);
      await lockObjectOwner(tx, ids[0]);
      const [membership] = await tx`
        select id from garage_memberships
        where id = ${membershipId} and owner_id = ${ids[0]}
          and member_id = ${ids[1]} and revoked_at is null for update
      `;
      assert.ok(membership);
      writerReady.resolve();
      await deadline(releaseWriter.promise, "Releasing shared writer");
      await tx`
        insert into garage_activity
          (owner_id, actor_id, membership_id, record_table, record_id)
        values (${ids[0]}, ${ids[1]}, ${membershipId}, 'maintenance_records', ${randomUUID()})
      `;
      throw rollback;
    }),
  );
  await deadline(
    Promise.race([
      writerReady.promise,
      writer.then((result) => {
        throw result.reason ?? new Error("Writer ended before its barrier");
      }),
    ]),
    "Acquiring shared writer locks",
  );
  const deletion = outcome(
    db.begin(async (tx) => {
      await transactionSettings(tx);
      deletionPid = (await tx`select pg_backend_pid() as pid`)[0].pid;
      deletionReady.resolve();
      // Account deletion uses the same owner mutex before its cascade.
      await lockObjectOwner(tx, ids[target]);
      await tx`delete from neon_auth."user" where id = ${ids[target]}`;
      throw rollback;
    }),
  );
  let waitError;
  try {
    await deadline(deletionReady.promise, "Starting account deletion");
    await waitForBlock(db, deletionPid, writerPid);
  } catch (cause) {
    waitError = cause;
  } finally {
    releaseWriter.resolve();
  }
  const results = await Promise.all([writer, deletion]);
  if (waitError) throw waitError;
  assertRollback(results[0], "Shared writer");
  assertRollback(
    results[1],
    target === 0 ? "Owner deletion" : "Actor deletion",
  );
}

async function verifyOppositeActors(db, ids, memberships) {
  const bothLocked = signal();
  let ready = 0;
  const write = (ownerIndex) =>
    outcome(
      db.begin(async (tx) => {
        await transactionSettings(tx);
        await lockAccountActor(tx, ids[1 - ownerIndex]);
        await lockObjectOwner(tx, ids[ownerIndex]);
        await tx`
          select id from garage_memberships where id = ${memberships[ownerIndex]}
            and revoked_at is null for update
        `;
        if (++ready === 2) bothLocked.resolve();
        await deadline(bothLocked.promise, "Opposite-actor lock barrier");
        await tx`
          insert into garage_activity
            (owner_id, actor_id, membership_id, record_table, record_id)
          values (${ids[ownerIndex]}, ${ids[1 - ownerIndex]},
            ${memberships[ownerIndex]}, 'maintenance_records', ${randomUUID()})
        `;
        throw rollback;
      }),
    );
  const results = await Promise.all([write(0), write(1)]);
  results.forEach((result) => assertRollback(result, "Opposite-actor writer"));
}

async function verifyProfileOperation(db, ids, membershipId, kind) {
  const invitationId = randomUUID();
  if (kind === "accept") {
    await db`update garage_memberships set role = 'viewer', revoked_at = now()
      where id = ${membershipId}`;
    await db`
      insert into garage_invitations
        (id, owner_id, invited_email, role, token_hash, token_prefix, expires_at)
      values (${invitationId}, ${ids[0]}, ${`garage-concurrency-${ids[1]}@example.invalid`},
        'workshop', ${randomUUID()}, 'fixture', now() + interval '1 day')
    `;
  }
  const writerReady = signal();
  const deletionReady = signal();
  const releaseWriter = signal();
  let writerPid;
  let deletionPid;
  const writer = outcome(
    db.begin(async (tx) => {
      await transactionSettings(tx);
      writerPid = (await tx`select pg_backend_pid() as pid`)[0].pid;
      if (kind === "accept") await lockAccountActor(tx, ids[1]);
      await lockObjectOwner(tx, ids[0]);
      await tx`select id from profiles where id = ${ids[0]} for update`;
      if (kind === "accept") {
        await tx`
          select id from garage_invitations where id = ${invitationId}
            and revoked_at is null and accepted_at is null and expires_at > now() for update
        `;
        await tx`
          insert into garage_memberships (owner_id, member_id, role)
          values (${ids[0]}, ${ids[1]}, 'workshop')
          on conflict (owner_id, member_id) do update
            set role = excluded.role, revoked_at = null returning id
        `;
      }
      writerReady.resolve();
      await deadline(releaseWriter.promise, "Releasing profile writer");
      if (kind === "calendar")
        await tx`
          insert into calendar_feeds (owner_id, token_hash, token_prefix, locale, expires_at)
          values (${ids[0]}, ${randomUUID()}, 'fixture', 'pt-BR', now() + interval '1 day')
        `;
      else if (kind === "invite")
        await tx`
          insert into garage_invitations
            (owner_id, invited_email, role, token_hash, token_prefix, expires_at)
          values (${ids[0]}, 'fixture@example.invalid', 'viewer', ${randomUUID()},
            'fixture', now() + interval '1 day')
        `;
      else
        await tx`
          update garage_invitations set accepted_at = now(), accepted_by = ${ids[1]}
          where id = ${invitationId}
        `;
      throw rollback;
    }),
  );
  await deadline(
    Promise.race([
      writerReady.promise,
      writer.then((result) => {
        throw (
          result.reason ?? new Error("Profile writer ended before its barrier")
        );
      }),
    ]),
    "Acquiring profile writer locks",
  );
  const deletionId = ids[kind === "accept" ? 1 : 0];
  const deletion = outcome(
    db.begin(async (tx) => {
      await transactionSettings(tx);
      deletionPid = (await tx`select pg_backend_pid() as pid`)[0].pid;
      deletionReady.resolve();
      await lockObjectOwner(tx, deletionId);
      await tx`delete from neon_auth."user" where id = ${deletionId}`;
      throw rollback;
    }),
  );
  let waitError;
  try {
    await deadline(deletionReady.promise, "Starting profile account deletion");
    await waitForBlock(db, deletionPid, writerPid);
  } catch (cause) {
    waitError = cause;
  } finally {
    releaseWriter.resolve();
  }
  const results = await Promise.all([writer, deletion]);
  if (waitError) throw waitError;
  assertRollback(results[0], `${kind} operation`);
  assertRollback(results[1], `${kind} account deletion`);
}

async function main() {
  assert.equal(
    process.env.CORE_TEST_BRANCH,
    "br-dawn-glitter-ac0vy5bm",
    "Explicit disposable branch opt-in required",
  );
  const connection = process.env.DATABASE_URL_UNPOOLED;
  assert.equal(
    new URL(connection).hostname,
    "ep-aged-haze-achz0xp9.sa-east-1.aws.neon.tech",
    "Unexpected database endpoint",
  );
  const db = postgres(connection, { ssl: "require", prepare: false, max: 4 });
  const ids = [randomUUID(), randomUUID()];
  const memberships = [randomUUID(), randomUUID()];
  try {
    for (const id of ids) {
      await db`
        insert into neon_auth."user"
          (id, name, email, "emailVerified", "createdAt", "updatedAt")
        values (${id}, 'Garage concurrency fixture',
          ${`garage-concurrency-${id}@example.invalid`}, true, now(), now())
      `;
      await db`insert into profiles (id, email)
        values (${id}, ${`garage-concurrency-${id}@example.invalid`})`;
    }
    for (const ownerIndex of [0, 1])
      await db`
        insert into garage_memberships (id, owner_id, member_id, role)
        values (${memberships[ownerIndex]}, ${ids[ownerIndex]},
          ${ids[1 - ownerIndex]}, 'workshop')
      `;
    await verifyDeletion(db, ids, memberships[0], 1);
    await verifyDeletion(db, ids, memberships[0], 0);
    await verifyOppositeActors(db, ids, memberships);
    await verifyProfileOperation(db, ids, memberships[0], "calendar");
    await verifyProfileOperation(db, ids, memberships[0], "invite");
    await verifyProfileOperation(db, ids, memberships[0], "accept");
    await assert.rejects(
      db.begin((tx) => lockAccountActor(tx, randomUUID())),
      { message: "Account no longer exists." },
    );
  } finally {
    try {
      await db`delete from neon_auth."user" where id in ${db(ids)}`;
      const [remaining] = await db`
        select count(*)::int as count from neon_auth."user" where id in ${db(ids)}
      `;
      assert.equal(
        remaining.count,
        0,
        "Disposable accounts removed completely",
      );
    } finally {
      await db.end();
    }
  }
  console.log(
    "PASS: shared writer, calendar, invitation creation/acceptance vs account deletion; opposite actors, missing actor; fixtures removed",
  );
}

main().catch((cause) => {
  console.error({ message: cause.message, code: cause.code });
  process.exitCode = 1;
});
