import type { Subscription } from "dodopayments/resources/subscriptions";
import { billingEnvironment, dodoClient, intervalForProduct } from "./billing";
import { isoTimestampValue } from "./date-value";

type Profile = Record<string, unknown>;
export type AccountBillingSummary = {
  trialEndsAt: string | null;
  nextBillingAt: string | null;
};

/** Display-only provider data. Entitlements continue to come from signed webhooks. */
export function verifiedAccountBillingSummary(
  subscription: Subscription,
  profile: Profile,
  ownerId: string,
  environment: string,
  now = Date.now(),
): AccountBillingSummary | null {
  if (
    subscription.subscription_id !== profile.billing_subscription_id ||
    subscription.customer.customer_id !== profile.billing_customer_id ||
    subscription.product_id !== profile.billing_product_id ||
    subscription.metadata?.user_id !== ownerId ||
    subscription.metadata?.app !== "moto_track" ||
    subscription.metadata?.environment !== environment ||
    profile.billing_environment !== environment ||
    profile.billing_provider !== "dodo" ||
    subscription.status !== "active" ||
    profile.billing_subscription_status !== "active"
  )
    return null;
  const nextBillingAt = isoTimestampValue(subscription.next_billing_date);
  if (
    !nextBillingAt ||
    nextBillingAt !== isoTimestampValue(profile.current_period_end)
  )
    return null;
  const createdAt = Date.parse(subscription.created_at);
  const days = subscription.trial_period_days;
  const trialEnd = createdAt + days * 86_400_000;
  const trialEndsAt =
    Number.isSafeInteger(days) &&
    days > 0 &&
    Number.isFinite(trialEnd) &&
    createdAt <= now &&
    trialEnd > now
      ? isoTimestampValue(new Date(trialEnd))
      : null;
  return { trialEndsAt, nextBillingAt };
}

export async function fetchAccountBillingSummary(
  profile: Profile | undefined,
  ownerId: string,
  platform?: App.Platform,
): Promise<AccountBillingSummary | null> {
  if (
    !profile?.billing_subscription_id ||
    profile.billing_subscription_status !== "active"
  )
    return null;
  try {
    const environment = billingEnvironment(platform);
    const subscription = await dodoClient(platform).subscriptions.retrieve(
      String(profile.billing_subscription_id),
      { timeout: 3000, maxRetries: 0 },
    );
    if (!intervalForProduct(subscription.product_id, platform)) return null;
    return verifiedAccountBillingSummary(
      subscription,
      profile,
      ownerId,
      environment,
    );
  } catch {
    // A provider outage must not block settings or turn paid access into a trial.
    return null;
  }
}
