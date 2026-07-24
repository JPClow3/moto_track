import { error } from "@sveltejs/kit";
import { shareTokenHash } from "$server/domain/sale-report-share";

type ApiAuthEvent = {
  locals: App.Locals;
  request: Request;
};

/**
 * Session or personal API token, resolved to the same shape either way.
 *
 * Unlike the old Supabase version, there is no separate admin/service-role
 * client to reach for on the token path: Neon has no RLS, so `locals.db`
 * already has full access and a resolved owner id is all a query needs.
 */
export async function requireApiUser(
  event: ApiAuthEvent,
): Promise<{ user: { id: string }; via: "session" | "token" }> {
  if (event.locals.user) {
    return { user: event.locals.user, via: "session" };
  }

  const header = event.request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw error(401, "Authentication required.");

  const token = match[1].trim();
  const keyHash = await shareTokenHash(token);
  const [row] = await event.locals.db<
    Array<{ id: string; owner_id: string; is_active: boolean }>
  >`
    select id, owner_id, is_active from api_tokens
    where key_hash = ${keyHash}
  `.catch(
    () => [] as Array<{ id: string; owner_id: string; is_active: boolean }>,
  );
  if (!row?.is_active || !row.owner_id) {
    throw error(401, "Invalid or inactive API token.");
  }

  await event.locals.db`
    update api_tokens set last_used_at = ${new Date().toISOString()}
    where id = ${row.id}
  `;

  return { user: { id: row.owner_id }, via: "token" };
}
