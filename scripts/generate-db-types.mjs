import { readFile, writeFile } from "node:fs/promises";

const sqlPath = new URL(
  "../supabase/migrations/202607060001_initial_schema.sql",
  import.meta.url,
);
const outPath = new URL("../src/lib/types/database.ts", import.meta.url);
const sql = await readFile(sqlPath, "utf8");

const enumMatches = [
  ...sql.matchAll(/create type (\w+) as enum \(([^)]+)\);/g),
];
const enums = Object.fromEntries(
  enumMatches.map((match) => [
    match[1],
    match[2]
      .split(",")
      .map((value) => value.trim().replaceAll("'", '"'))
      .join(" | "),
  ]),
);

function tsType(dbType) {
  const normalized = dbType.toLowerCase();
  if (normalized.includes("boolean")) return "boolean";
  if (
    normalized.includes("integer") ||
    normalized.includes("bigint") ||
    normalized.includes("numeric")
  ) {
    return "number";
  }
  if (normalized.includes("jsonb")) return "Json";
  if (enums[normalized]) return `Database["public"]["Enums"]["${normalized}"]`;
  return "string";
}

function parseColumns(body) {
  return body
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(
      (line) =>
        line &&
        !line.startsWith("unique ") &&
        !line.startsWith("check ") &&
        !line.startsWith("primary key"),
    )
    .map((line) => {
      const match = line.match(/^(\w+)\s+(.+)$/);
      if (!match) return null;
      const [, name, rest] = match;
      if (["constraint", "foreign", "primary"].includes(name)) return null;
      const typePart = rest
        .split(
          /\s+(not null|primary key|references|default|check|unique)\b/i,
        )[0]
        .trim();
      const nullable = !/not null|primary key/i.test(rest);
      const hasDefault = /default\b|primary key/i.test(rest);
      return {
        name,
        type: tsType(typePart),
        nullable,
        optional: nullable || hasDefault,
      };
    })
    .filter(Boolean);
}

const tableMatches = [
  ...sql.matchAll(/create table public\.(\w+) \(([\s\S]*?)\n\);/g),
];
const tables = tableMatches.map((match) => ({
  name: match[1],
  columns: parseColumns(match[2]),
}));

function property(column, mode) {
  const optional = mode !== "Row" && column.optional ? "?" : "";
  const nullable = column.nullable ? " | null" : "";
  return `          ${column.name}${optional}: ${column.type}${nullable};`;
}

const file = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
${tables
  .map(
    (table) => `      ${table.name}: {
        Row: {
${table.columns.map((column) => property(column, "Row")).join("\n")}
        };
        Insert: {
${table.columns.map((column) => property(column, "Insert")).join("\n")}
        };
        Update: {
${table.columns.map((column) => `          ${column.name}?: ${column.type}${column.nullable ? " | null" : ""};`).join("\n")}
        };
        Relationships: [];
      };`,
  )
  .join("\n")}
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
${Object.entries(enums)
  .map(([name, values]) => `      ${name}: ${values};`)
  .join("\n")}
    };
    CompositeTypes: Record<string, never>;
  };
};

export type PublicTableName = keyof Database["public"]["Tables"];
`;

await writeFile(outPath, file);
console.log(
  `Generated ${tables.length} table definitions at ${outPath.pathname}`,
);
