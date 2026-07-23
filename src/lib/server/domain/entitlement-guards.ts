import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database";
import {
  FREE_REMINDER_LIMIT,
  FREE_UPLOAD_LIMIT,
  FREE_WORK_SESSION_MONTHLY_LIMIT,
  hasProAccess,
  type SubscriptionProfile,
} from "$server/domain/entitlements";

export async function loadSubscriptionProfile(
  supabase: SupabaseClient<Database>,
  ownerId: string,
) {
  const { data } = await supabase
    .from("subscription_profiles")
    .select("plan, stripe_subscription_status, grace_until")
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data as SubscriptionProfile | null;
}

export async function assertCanCreateUpload(
  supabase: SupabaseClient<Database>,
  ownerId: string,
) {
  const profile = await loadSubscriptionProfile(supabase, ownerId);
  if (hasProAccess(profile)) return null;
  const { count, error } = await supabase
    .from("object_files")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  if (error) return error.message;
  if ((count ?? 0) >= FREE_UPLOAD_LIMIT) {
    return `O plano Free permite até ${FREE_UPLOAD_LIMIT} uploads. Assine o Pro para liberar mais.`;
  }
  return null;
}

export async function assertCanCreateReminder(
  supabase: SupabaseClient<Database>,
  ownerId: string,
) {
  const profile = await loadSubscriptionProfile(supabase, ownerId);
  if (hasProAccess(profile)) return null;
  const { count, error } = await supabase
    .from("reminders")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("is_active", true);
  if (error) return error.message;
  if ((count ?? 0) >= FREE_REMINDER_LIMIT) {
    return `O plano Free permite até ${FREE_REMINDER_LIMIT} lembretes ativos. Assine o Pro para liberar mais.`;
  }
  return null;
}

export async function assertCanCreateWorkSession(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  now = new Date(),
) {
  const profile = await loadSubscriptionProfile(supabase, ownerId);
  if (hasProAccess(profile)) return null;
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const { count, error } = await supabase
    .from("work_sessions")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .gte("work_date", monthStart);
  if (error) return error.message;
  if ((count ?? 0) >= FREE_WORK_SESSION_MONTHLY_LIMIT) {
    return `O plano Free permite até ${FREE_WORK_SESSION_MONTHLY_LIMIT} turnos por mês. Assine o Pro para liberar mais.`;
  }
  return null;
}
