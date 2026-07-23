import type { Sql } from "postgres";

// Supabase seeded `profiles` + `subscription_profiles` via a trigger on
// `auth.users`. Neon Auth (Better Auth) does not fire such a trigger, so the
// app provisions those rows on demand the first time it sees an authenticated
// user. Idempotent: safe to call on every request.
export async function ensureAccount(
  db: Sql,
  userId: string,
  email: string | null,
) {
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
}
