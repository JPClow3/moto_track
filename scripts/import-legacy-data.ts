import { createReadStream, existsSync, readFileSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { v5 as uuidv5 } from "uuid";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LEGACY_NAMESPACE = "a87ff679-a2f3-5d3b-9b74-82d2b8b7621a";
const legacyRoot =
  process.env.LEGACY_ROOT ?? join(process.cwd(), "_legacy", "django");
const exportPath =
  process.env.LEGACY_EXPORT_PATH ?? join(process.cwd(), "legacy-export.json");

// Minimal .env loader (no dotenv dependency), matching db/apply.mjs — only
// fills in vars that aren't already set, so a real env var always wins.
function loadDotEnv(path: string) {
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

const sql = postgres(databaseUrl, { prepare: false, ssl: "require" });

function mapId(table: string, id: string | number) {
  return uuidv5(`${table}:${id}`, LEGACY_NAMESPACE);
}

async function importJsonExport() {
  if (!existsSync(exportPath)) {
    console.warn(
      `No legacy JSON export found at ${exportPath}. Skipping row import.`,
    );
    return;
  }
  const exportData = JSON.parse(await readFile(exportPath, "utf8")) as Record<
    string,
    Array<Record<string, unknown>>
  >;
  for (const [table, rows] of Object.entries(exportData)) {
    const mapped = rows.map((row) => ({
      ...row,
      id: row.id ? mapId(table, row.id as string | number) : row.id,
    }));
    if (mapped.length === 0) continue;
    // Greenfield target DB (no rows to preserve on conflict), so a re-run of
    // this importer simply skips rows it already inserted.
    await sql`
      insert into ${sql(table)} ${sql(mapped)}
      on conflict (id) do nothing
    `;
    console.log(`Imported ${mapped.length} rows into ${table}`);
  }
}

async function listFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry);
      const info = await stat(path);
      return info.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return files.flat();
}

async function importMediaManifest() {
  const mediaRoot = join(legacyRoot, "media");
  const files = await listFiles(mediaRoot);
  for (const file of files) {
    const key = relative(mediaRoot, file).replaceAll("\\", "/");
    console.log(`Media candidate: ${key}`);
    createReadStream(file).close();
  }
  if (files.length) {
    console.warn(
      "R2 upload is intentionally left to wrangler/aws s3 sync because R2 credentials are provider-specific.",
    );
  }
}

try {
  await importJsonExport();
  await importMediaManifest();
} finally {
  await sql.end({ timeout: 5 });
}
