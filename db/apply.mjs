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
import { dirname, join } from "node:path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "migrations");

// Minimal .env loader (no dotenv dependency) — only fills in vars that
// aren't already set in the environment, matching dotenv's default
// precedence so a real env var always wins over the file.
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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required (set it in the environment or in .env).",
  );
}

async function main() {
  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .sql files found in ${migrationsDir}`);
  }

  const sql = postgres(databaseUrl, { prepare: false, ssl: "require" });

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
      console.log("No pending migrations; schema is up to date.");
      return;
    }

    console.log(`Applying ${pending.length} pending migration(s) to Neon...`);

    for (const file of pending) {
      const filePath = join(migrationsDir, file);
      const query = await readFile(filePath, "utf8");
      console.log(`  -> ${file}`);
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(query);
          await tx`
            insert into public.schema_migrations (filename) values (${file})
          `;
        });
      } catch (err) {
        console.error(
          `Migration ${file} failed; that transaction rolled back.`,
        );
        console.error(
          `Migrations applied before this one are recorded and won't be replayed.`,
        );
        throw err;
      }
    }
    console.log("All pending migrations applied successfully.");
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await main();
