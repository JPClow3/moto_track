import { json, error } from "@sveltejs/kit";
import { createPersonalApiToken } from "$server/domain/api-tokens";

export async function GET({ locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const { data, error: dbError } = await locals.supabase
    .from("api_tokens")
    .select("id, name, key_prefix, scopes, is_active, last_used_at, created_at")
    .eq("owner_id", locals.user.id)
    .order("created_at", { ascending: false });
  if (dbError) throw error(400, dbError.message);
  return json({ results: data ?? [] });
}

export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const body = (await request.json().catch(() => null)) as {
    name?: string;
  } | null;
  const name = body?.name?.trim() || "Personal token";
  const created = await createPersonalApiToken();
  const { data, error: dbError } = await locals.supabase
    .from("api_tokens")
    .insert({
      owner_id: locals.user.id,
      name,
      key_hash: created.keyHash,
      key_prefix: created.keyPrefix,
      scopes: "read,write",
      is_active: true,
    })
    .select("id, name, key_prefix, scopes, is_active, created_at")
    .maybeSingle();
  if (dbError) throw error(400, dbError.message);
  return json(
    {
      result: data,
      token: created.token,
    },
    { status: 201 },
  );
}

export async function DELETE({ request, locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) throw error(400, "Query parameter id is required.");
  const { error: dbError } = await locals.supabase
    .from("api_tokens")
    .delete()
    .eq("id", id)
    .eq("owner_id", locals.user.id);
  if (dbError) throw error(400, dbError.message);
  return json({ ok: true });
}
