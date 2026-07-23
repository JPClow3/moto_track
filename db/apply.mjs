// Applies every db/migrations/*.sql file (in filename order) to the Neon
// database referenced by DATABASE_URL, inside a single transaction so a
// failed statement rolls back the whole run instead of leaving the schema
// half-created. Run with `npm run db:push`.
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

  console.log(`Applying ${files.length} migration(s) to Neon...`);

  try {
    await sql.begin(async (tx) => {
      for (const file of files) {
        const filePath = join(migrationsDir, file);
        const query = await readFile(filePath, "utf8");
        console.log(`  -> ${file}`);
        await tx.unsafe(query);
      }
    });
    console.log("All migrations applied successfully.");
  } catch (err) {
    console.error("Migration run failed; transaction rolled back.");
    console.error(err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await main();
