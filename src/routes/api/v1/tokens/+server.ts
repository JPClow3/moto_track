import { json, error } from "@sveltejs/kit";
import { createPersonalApiToken } from "$server/domain/api-tokens";

type TokenRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function GET({ locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  try {
    const results = await locals.db<TokenRow[]>`
      select id, name, key_prefix, scopes, is_active, last_used_at, created_at
      from api_tokens
      where owner_id = ${locals.user.id}
      order by created_at desc
    `;
    return json({ results });
  } catch (err) {
    throw error(400, messageFrom(err));
  }
}

export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const body = (await request.json().catch(() => null)) as {
    name?: string;
  } | null;
  const name = body?.name?.trim() || "Personal token";
  const created = await createPersonalApiToken();
  try {
    const [result] = await locals.db<
      Array<
        Pick<
          TokenRow,
          "id" | "name" | "key_prefix" | "scopes" | "is_active" | "created_at"
        >
      >
    >`
      insert into api_tokens ${locals.db({
        owner_id: locals.user.id,
        name,
        key_hash: created.keyHash,
        key_prefix: created.keyPrefix,
        scopes: "read,write",
        is_active: true,
      })}
      returning id, name, key_prefix, scopes, is_active, created_at
    `;
    return json({ result, token: created.token }, { status: 201 });
  } catch (err) {
    throw error(400, messageFrom(err));
  }
}

export async function DELETE({ request, locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) throw error(400, "Query parameter id is required.");
  try {
    await locals.db`
      delete from api_tokens
      where id = ${id} and owner_id = ${locals.user.id}
    `;
  } catch (err) {
    throw error(400, messageFrom(err));
  }
  return json({ ok: true });
}
