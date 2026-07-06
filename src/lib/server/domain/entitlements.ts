export const FREE_ACTIVE_MOTORCYCLE_LIMIT = 1;
export const FREE_UPLOAD_LIMIT = 3;
export const FREE_REMINDER_LIMIT = 3;
export const FREE_WORK_SESSION_MONTHLY_LIMIT = 3;

export type SubscriptionProfile = {
  plan?: "free" | "pro" | string | null;
  stripe_subscription_status?: string | null;
  grace_until?: string | null;
};

export function hasProAccess(
  profile: SubscriptionProfile | null | undefined,
  now = new Date(),
) {
  if (!profile || profile.plan !== "pro") return false;
  if (
    profile.stripe_subscription_status === "active" ||
    profile.stripe_subscription_status === "trialing"
  )
    return true;
  if (!profile.grace_until) return false;
  return new Date(profile.grace_until).getTime() >= now.getTime();
}

export function remainingFreeSlots({
  hasPro,
  limit,
  used,
}: {
  hasPro: boolean;
  limit: number;
  used: number;
}) {
  return hasPro ? null : Math.max(limit - used, 0);
}
