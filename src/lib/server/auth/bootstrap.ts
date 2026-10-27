import type { Sql } from "postgres";
import type { Locale } from "$lib/i18n";

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
  locale?: Locale,
) {
  if (provisionedAccounts.has(userId)) return;
  await db`
    insert into profiles (id, email, preferred_locale)
    values (${userId}, ${email ?? ""}, ${locale ?? "pt-BR"})
    on conflict (id) do update set preferred_locale = excluded.preferred_locale
      where ${locale !== undefined} and profiles.preferred_locale is distinct from excluded.preferred_locale
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
