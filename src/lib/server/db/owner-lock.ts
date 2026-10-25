import type { Sql } from "postgres";

/** Keep a shared-record actor alive before locking the owner's rows. */
export async function lockAccountActor(db: Sql, actorId: string) {
  const [actor] = await db<Array<{ id: string }>>`
    select id from neon_auth."user" where id = ${actorId} for key share
  `;
  if (!actor) throw new Error("Account no longer exists.");
}

/** Serialize an account's writes without blocking foreign-key KEY SHARE locks. */
export async function lockObjectOwner(db: Sql, ownerId: string) {
  const [owner] = await db<Array<{ id: string }>>`
    select id from neon_auth."user" where id = ${ownerId} for no key update
  `;
  if (!owner) throw new Error("Account no longer exists.");
}
