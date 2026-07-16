import { error } from "@sveltejs/kit";
import { ACCOUNT_EXPORT_TABLES } from "$server/domain/account-data";

export async function GET({ locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const ownerId = locals.user.id;
  const db = locals.supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
  const records = await Promise.all(
    ACCOUNT_EXPORT_TABLES.map(async (table) => {
      const { data, error: queryError } = await db
        .from(table)
        .select("*")
        .eq("owner_id", ownerId);
      if (queryError) throw error(500, `Could not export ${table}.`);
      return [table, data ?? []] as const;
    }),
  );
  const { data: profile, error: profileError } = await locals.supabase
    .from("profiles")
    .select("id, email, full_name, theme, created_at, updated_at")
    .eq("id", ownerId)
    .maybeSingle();
  if (profileError) throw error(500, "Could not export profile.");

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile,
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
