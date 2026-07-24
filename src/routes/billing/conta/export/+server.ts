import { error } from "@sveltejs/kit";
import { ACCOUNT_EXPORT_TABLES } from "$server/domain/account-data";

export async function GET({ locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const ownerId = locals.user.id;
  const db = locals.db;

  const records = await Promise.all(
    ACCOUNT_EXPORT_TABLES.map(async (table) => {
      let rows: Record<string, unknown>[];
      try {
        rows = await db<Record<string, unknown>[]>`
          select * from ${db(table)}
          where owner_id = ${ownerId}
        `;
      } catch {
        throw error(500, `Could not export ${table}.`);
      }
      return [table, rows] as const;
    }),
  );

  let profile: Record<string, unknown> | undefined;
  try {
    [profile] = await db<Record<string, unknown>[]>`
      select id, email, full_name, theme, created_at, updated_at
      from profiles
      where id = ${ownerId}
    `;
  } catch {
    throw error(500, "Could not export profile.");
  }

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile: profile ?? null,
      records: Object.fromEntries(records),
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": 'attachment; filename="moto-track-dados.json"',
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
