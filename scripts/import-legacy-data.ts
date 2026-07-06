import { createReadStream, existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const LEGACY_NAMESPACE = "a87ff679-a2f3-5d3b-9b74-82d2b8b7621a";
const legacyRoot =
  process.env.LEGACY_ROOT ?? join(process.cwd(), "_legacy", "django");
const exportPath =
  process.env.LEGACY_EXPORT_PATH ?? join(process.cwd(), "legacy-export.json");

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRole) {
  throw new Error(
    "PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
    const { error } = await supabase.from(table).upsert(mapped);
    if (error) throw new Error(`Failed importing ${table}: ${error.message}`);
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

await importJsonExport();
await importMediaManifest();
