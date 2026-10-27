import type { Sql } from "postgres";

// Supabase seeded `profiles` + `subscription_profiles` via a trigger on
// `auth.users`. Neon Auth (Better Auth) does not fire such a trigger, so the
// app provisions those rows on demand the first time it sees an authenticated
// user. The inserts are `on conflict do nothing`, so a success does not need
// to open Postgres again for the life of this isolate.
const provisionedAccounts = new Set<string>();
const PROVISIONED_ACCOUNT_LIMIT = 1000;

export async function ensureAccount(
  db: Sql,
  userId: string,
  email: string | null,
) {
  if (provisionedAccounts.has(userId)) return;
  await db`
    insert into profiles (id, email)
    values (${userId}, ${email ?? ""})
    on conflict (id) do nothing
  `;
  await db`
    insert into subscription_profiles (owner_id, plan)
    values (${userId}, 'free')
    on conflict (owner_id) do nothing
  `;
  provisionedAccounts.add(userId);
  if (provisionedAccounts.size > PROVISIONED_ACCOUNT_LIMIT) {
    const oldest = provisionedAccounts.values().next().value;
    if (oldest) provisionedAccounts.delete(oldest);
  }
}
