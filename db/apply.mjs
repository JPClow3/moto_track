// Applies db/migrations/*.sql files (in filename order) to the Neon database
// referenced by DATABASE_URL. Applied filenames are recorded in
// public.schema_migrations so a rerun only replays files added since the
// last run — some migrations (e.g. `create type ... as enum`) can't be
// written to tolerate a second execution, so replaying everything on every
// run isn't safe. Each pending file runs in its own transaction, so one
// failure doesn't roll back migrations that already succeeded. Run with
// `npm run db:push`.
import { readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "migrations");

// Minimal .env loader (no dotenv dependency) — only fills in vars that
// aren't already set in the environment, matching dotenv's default
// precedence so a real env var always wins over the file.
/** @param {string} path */
function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const contents = readFileSync(path, "utf8");
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(join(__dirname, "..", ".env"));

/**
 * @param {string} databaseUrl
 * @returns {{ prepare: false, ssl: false | "require" }}
 */
export function postgresOptions(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const hostname = parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  const isNeon = hostname === "neon.tech" || hostname.endsWith(".neon.tech");

  // Neon always requires TLS. Local disposable databases normally do not,
  // while explicit sslmode settings remain useful for other PostgreSQL hosts.
  if (
    isNeon ||
    sslMode === "require" ||
    sslMode === "verify-ca" ||
    sslMode === "verify-full"
  ) {
    return { prepare: false, ssl: "require" };
  }
  if (isLocal || sslMode === "disable") {
    return { prepare: false, ssl: false };
  }
  return { prepare: false, ssl: "require" };
}

export async function applyMigrations({
  databaseUrl = process.env.DATABASE_URL,
  logger = console,
} = {}) {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required (set it in the environment or in .env).",
    );
  }

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .sql files found in ${migrationsDir}`);
  }

  const sql = postgres(databaseUrl, postgresOptions(databaseUrl));

  try {
    await sql`
      create table if not exists public.schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const applied = new Set(
      (await sql`select filename from public.schema_migrations`).map(
        (row) => row.filename,
      ),
    );
    const pending = files.filter((file) => !applied.has(file));

    if (pending.length === 0) {
      logger.log("No pending migrations; schema is up to date.");
      return { applied: 0, total: files.length };
    }

    logger.log(`Applying ${pending.length} pending migration(s)...`);

    for (const file of pending) {
      const filePath = join(migrationsDir, file);
      const query = await readFile(filePath, "utf8");
      logger.log(`  -> ${file}`);
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(query);
          await tx`
            insert into public.schema_migrations (filename) values (${file})
          `;
        });
      } catch (err) {
        logger.error(`Migration ${file} failed; that transaction rolled back.`);
        logger.error(
          `Migrations applied before this one are recorded and won't be replayed.`,
        );
        throw err;
      }
    }
    logger.log("All pending migrations applied successfully.");
    return { applied: pending.length, total: files.length };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  try {
    await applyMigrations();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}
