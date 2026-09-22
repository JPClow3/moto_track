// Integration gate for the complete migration chain. It is intentionally a
// plain Node script so it runs unchanged on Windows and in GitHub Actions.
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { applyMigrations, postgresOptions } from "./apply.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "migrations");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for the migration integration test.",
  );
}

const parsed = new URL(databaseUrl);
const hostname = parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
  throw new Error(
    "Refusing to run the destructive empty-database migration check against a non-local host.",
  );
}

const files = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const sql = postgres(databaseUrl, postgresOptions(databaseUrl));

try {
  const publicTables = await sql`
    select count(*)::integer as count
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  `;
  if (publicTables[0].count !== 0) {
    throw new Error(
      `Migration integration database must be empty; found ${publicTables[0].count} public table(s).`,
    );
  }

  // Neon Auth owns this table in production. A minimal stand-in is sufficient
  // to validate every application foreign key in a disposable PostgreSQL DB.
  await sql`create schema if not exists neon_auth`;
  await sql`
    create table if not exists neon_auth."user" (
      id uuid primary key
    )
  `;
} finally {
  await sql.end({ timeout: 5 });
}

const firstRun = await applyMigrations({ databaseUrl });
if (firstRun.applied !== files.length) {
  throw new Error(
    `Expected the empty database to apply ${files.length} migrations, but applied ${firstRun.applied}.`,
  );
}

const secondRun = await applyMigrations({ databaseUrl });
if (secondRun.applied !== 0) {
  throw new Error(
    `Migration runner is not idempotent: the second run applied ${secondRun.applied} migration(s).`,
  );
}

const verificationSql = postgres(databaseUrl, postgresOptions(databaseUrl));
try {
  const appliedRows = await verificationSql`
    select filename
    from public.schema_migrations
    order by filename
  `;
  const appliedFiles = appliedRows.map((row) => row.filename);
  if (JSON.stringify(appliedFiles) !== JSON.stringify(files)) {
    throw new Error("schema_migrations does not exactly match db/migrations.");
  }
} finally {
  await verificationSql.end({ timeout: 5 });
}

console.log(
  `Verified ${files.length} migration(s) from an empty database; second run applied none.`,
);
