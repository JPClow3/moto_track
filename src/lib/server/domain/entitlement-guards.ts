import type { Sql } from "postgres";
import { runtimeEnv } from "$server/runtime";
import {
  FREE_REMINDER_LIMIT,
  FREE_UPLOAD_LIMIT,
  FREE_WORK_SESSION_MONTHLY_LIMIT,
  hasProAccess,
  type SubscriptionProfile,
} from "$server/domain/entitlements";

/**
 * App-layer backstop for the Free-plan caps. The matching database triggers
 * (db/migrations/20260723093000_enforce_free_entitlement_caps.sql) enforce the
 * same limits so a direct SQL write can't bypass them, but these guards are
 * what let a blocked create fail with a friendly message instead of a raw
 * constraint-violation error.
 */
export async function loadSubscriptionProfile(
  db: Sql,
  ownerId: string,
): Promise<SubscriptionProfile | null> {
  const [profile] = await db<SubscriptionProfile[]>`
    select plan, billing_provider, billing_environment, billing_subscription_status, grace_until,
      (select environment from billing_configuration where id = 1) as entitlement_environment
    from subscription_profiles
    where owner_id = ${ownerId}
  `.catch(() => [] as SubscriptionProfile[]);
  return profile ?? null;
}

export async function assertCanCreateUpload(
  db: Sql,
  ownerId: string,
  platform?: App.Platform,
) {
  const profile = await loadSubscriptionProfile(db, ownerId);
  if (
    hasProAccess(
      profile,
      new Date(),
      runtimeEnv(platform).DODO_PAYMENTS_ENVIRONMENT ?? "live_mode",
    )
  )
    return null;
  const [{ count }] = await db<Array<{ count: number }>>`
    select count(*)::int from object_files where owner_id = ${ownerId}
  `;
  if (count >= FREE_UPLOAD_LIMIT) {
    return `O plano Free permite até ${FREE_UPLOAD_LIMIT} uploads. Assine o Pro para liberar mais.`;
  }
  return null;
}

export async function assertCanCreateReminder(
  db: Sql,
  ownerId: string,
  platform?: App.Platform,
) {
  const profile = await loadSubscriptionProfile(db, ownerId);
  if (
    hasProAccess(
      profile,
      new Date(),
      runtimeEnv(platform).DODO_PAYMENTS_ENVIRONMENT ?? "live_mode",
    )
  )
    return null;
  const [{ count }] = await db<Array<{ count: number }>>`
    select count(*)::int from reminders
    where owner_id = ${ownerId} and is_active = true
  `;
  if (count >= FREE_REMINDER_LIMIT) {
    return `O plano Free permite até ${FREE_REMINDER_LIMIT} lembretes ativos. Assine o Pro para liberar mais.`;
  }
  return null;
}

export async function assertCanCreateWorkSession(
  db: Sql,
  ownerId: string,
  now = new Date(),
  platform?: App.Platform,
) {
  const profile = await loadSubscriptionProfile(db, ownerId);
  if (
    hasProAccess(
      profile,
      now,
      runtimeEnv(platform).DODO_PAYMENTS_ENVIRONMENT ?? "live_mode",
    )
  )
    return null;
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const [{ count }] = await db<Array<{ count: number }>>`
    select count(*)::int from work_sessions
    where owner_id = ${ownerId} and work_date >= ${monthStart}
  `;
  if (count >= FREE_WORK_SESSION_MONTHLY_LIMIT) {
    return `O plano Free permite até ${FREE_WORK_SESSION_MONTHLY_LIMIT} turnos por mês. Assine o Pro para liberar mais.`;
  }
  return null;
}
