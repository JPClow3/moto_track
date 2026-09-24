import Stripe from "stripe";
import { runtimeEnv } from "$server/runtime";
import type { PlanPrice, ProPricing } from "$types/billing";

export type { PlanPrice, ProPricing };

export type BillingInterval = "monthly" | "yearly";
export const PRO_TRIAL_DAYS = 7;

function hasConfiguredStripeSecret(value: string | undefined): value is string {
  return Boolean(value && !/(?:replace[-_ ]?me|placeholder)/i.test(value));
}

type StripeSubscriptionRecord = {
  id: string;
  customer: string | Stripe.Customer | Stripe.DeletedCustomer;
  status: string;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{
      price: { recurring: { interval: string } | null };
      current_period_end: number;
    }>;
  };
};

export function stripeClient(platform?: App.Platform) {
  const runtime = runtimeEnv(platform);
  if (!hasConfiguredStripeSecret(runtime.STRIPE_SECRET_KEY))
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(runtime.STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
  });
}

export function parseBillingInterval(value: string | null): BillingInterval {
  return value === "yearly" ? "yearly" : "monthly";
}

export function priceIdForInterval(
  interval: BillingInterval,
  platform?: App.Platform,
) {
  const runtime = runtimeEnv(platform);
  return interval === "yearly"
    ? runtime.STRIPE_PRO_YEARLY_PRICE_ID
    : runtime.STRIPE_PRO_MONTHLY_PRICE_ID;
}

const EMPTY_PRICING: ProPricing = { monthly: null, yearly: null };
const PRICING_TTL_MS = 5 * 60 * 1000;

let pricingCache: { value: ProPricing; expiresAt: number } | null = null;

async function retrievePrice(
  client: Stripe,
  priceId: string | undefined,
): Promise<PlanPrice | null> {
  if (!priceId) return null;
  const price = await client.prices.retrieve(priceId);
  // unit_amount is null for tiered/metered prices, which we cannot render as a
  // single headline figure.
  if (!price.active || price.unit_amount === null) return null;
  const interval = price.recurring?.interval;
  if (interval !== "month" && interval !== "year") return null;
  return {
    amountCents: price.unit_amount,
    currency: price.currency,
    interval,
  };
}

/**
 * Reads the live Pro prices from Stripe so the marketing pages cannot drift
 * away from what the checkout actually charges.
 *
 * Never throws: the pricing pages must still render if Stripe is unreachable or
 * unconfigured, in which case the caller falls back to a placeholder.
 */
export async function fetchProPricing(
  platform?: App.Platform,
): Promise<ProPricing> {
  const now = Date.now();
  if (pricingCache && pricingCache.expiresAt > now) return pricingCache.value;

  const runtime = runtimeEnv(platform);
  if (!hasConfiguredStripeSecret(runtime.STRIPE_SECRET_KEY))
    return EMPTY_PRICING;

  let client: Stripe;
  try {
    client = stripeClient(platform);
  } catch {
    return EMPTY_PRICING;
  }

  // Settled independently so one misconfigured price ID cannot blank the other.
  const [monthly, yearly] = await Promise.allSettled([
    retrievePrice(client, runtime.STRIPE_PRO_MONTHLY_PRICE_ID),
    retrievePrice(client, runtime.STRIPE_PRO_YEARLY_PRICE_ID),
  ]);

  for (const [label, result] of [
    ["monthly", monthly],
    ["yearly", yearly],
  ] as const) {
    if (result.status === "rejected") {
      console.error(`Stripe ${label} price lookup failed`, result.reason);
    }
  }

  const value: ProPricing = {
    monthly: monthly.status === "fulfilled" ? monthly.value : null,
    yearly: yearly.status === "fulfilled" ? yearly.value : null,
  };

  // Only cache a useful answer, so a transient Stripe outage doesn't pin the
  // placeholder in place for the full TTL.
  if (value.monthly || value.yearly) {
    pricingCache = { value, expiresAt: now + PRICING_TTL_MS };
  }
  return value;
}

/** Days of Pro access kept after a failed payment before hard revoke. */
export const PAYMENT_FAILURE_GRACE_DAYS = 3;

export function graceUntilFrom(now = new Date()) {
  return new Date(
    now.getTime() + PAYMENT_FAILURE_GRACE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export function subscriptionProfileUpdate(
  subscription: StripeSubscriptionRecord,
  now = new Date(),
) {
  const item = subscription.items.data[0];
  const interval = item?.price.recurring?.interval;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const status = subscription.status;
  const entitled = status === "active" || status === "trialing";
  const pastDue = status === "past_due";
  return {
    stripe_subscription_status: status,
    // past_due keeps plan=pro so hasProAccess can honour grace_until.
    plan: entitled || pastDue ? "pro" : "free",
    grace_until: pastDue ? graceUntilFrom(now) : null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    billing_interval: interval === "year" ? "yearly" : "monthly",
    cancel_at_period_end: subscription.cancel_at_period_end,
    current_period_end: item
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
  } as const;
}

/** Build one subscription Checkout Session for the selected recurring Price. */
export function buildCheckoutSessionParams({
  email,
  userId,
  customerId,
  interval,
  priceId,
  siteUrl,
}: {
  email: string;
  userId: string;
  customerId?: string;
  interval: BillingInterval;
  priceId: string;
  siteUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  const customer = customerId?.trim();
  const session: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_collection: "always",
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/billing/conta?checkout=success`,
    cancel_url: `${siteUrl}/precos?checkout=cancelled`,
    metadata: { user_id: userId, interval },
    subscription_data: {
      trial_period_days: PRO_TRIAL_DAYS,
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
      metadata: { user_id: userId, interval },
    },
  };
  if (customer) session.customer = customer;
  else session.customer_email = email;
  return session;
}

export async function createCheckoutSession({
  email,
  userId,
  customerId,
  interval,
  platform,
}: {
  email: string;
  userId: string;
  customerId?: string;
  interval: BillingInterval;
  platform?: App.Platform;
}) {
  const runtime = runtimeEnv(platform);
  const price = priceIdForInterval(interval, platform);
  if (!price) throw new Error("Stripe price ID is not configured.");
  const customer = customerId?.trim();
  const session = buildCheckoutSessionParams({
    email,
    userId,
    customerId: customer,
    interval,
    priceId: price,
    siteUrl: runtime.PUBLIC_SITE_URL || "http://localhost:5173",
  });
  const client = stripeClient(platform);
  try {
    return await client.checkout.sessions.create(session);
  } catch (err) {
    // A customer_id can go stale (e.g. left over from a Stripe mode switch, or
    // the customer was deleted in the dashboard); fall back to creating a
    // fresh customer by email instead of failing the whole checkout.
    if (
      customer &&
      (err as Stripe.errors.StripeError)?.code === "resource_missing"
    ) {
      delete session.customer;
      session.customer_email = email;
      return await client.checkout.sessions.create(session);
    }
    throw err;
  }
}

export async function createPortalSession(
  customerId: string,
  platform?: App.Platform,
) {
  const runtime = runtimeEnv(platform);
  return stripeClient(platform).billingPortal.sessions.create({
    customer: customerId,
    return_url: `${runtime.PUBLIC_SITE_URL || "http://localhost:5173"}/billing/conta`,
  });
}

function isMissingStripeResource(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "resource_missing"
  );
}

/**
 * Permanently stops Stripe billing before an account is removed locally.
 *
 * Both operations are deliberately idempotent: a retry after Stripe succeeded
 * but the Neon delete failed treats an already-removed Stripe resource as a
 * success. Deleting the customer also cancels any additional subscriptions
 * attached to it, so a stale local subscription id cannot leave billing live.
 * Any other provider failure is propagated and must prevent local deletion.
 */
export async function terminateStripeBillingForAccount(
  {
    customerId,
    subscriptionId,
  }: { customerId?: string | null; subscriptionId?: string | null },
  platform?: App.Platform,
) {
  const customer = customerId?.trim() ?? "";
  const subscription = subscriptionId?.trim() ?? "";
  if (!customer && !subscription) return;

  const client = stripeClient(platform);
  if (subscription) {
    try {
      await client.subscriptions.cancel(subscription);
    } catch (err) {
      if (!isMissingStripeResource(err)) throw err;
    }
  }

  if (customer) {
    try {
      await client.customers.del(customer);
    } catch (err) {
      if (!isMissingStripeResource(err)) throw err;
    }
  }
}

export function constructStripeEvent(
  payload: string,
  signature: string,
  platform?: App.Platform,
) {
  const runtime = runtimeEnv(platform);
  if (!runtime.STRIPE_WEBHOOK_SECRET)
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return stripeClient(platform).webhooks.constructEvent(
    payload,
    signature,
    runtime.STRIPE_WEBHOOK_SECRET,
  );
}
