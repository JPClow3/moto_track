import type { Sql } from "postgres";
import type { Locale } from "$lib/i18n";

// Supabase seeded `profiles` + `subscription_profiles` via a trigger on
// `auth.users`. Neon Auth (Better Auth) does not fire such a trigger, so the
// app provisions those rows on demand the first time it sees an authenticated
// user. Idempotent: safe to call on every request.
export async function ensureAccount(
  db: Sql,
  userId: string,
  email: string | null,
  locale?: Locale,
) {
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
}
