import Stripe from "stripe";
import { runtimeEnv } from "$server/runtime";
import type { PlanPrice, ProPricing } from "$types/billing";

export type { PlanPrice, ProPricing };

export function stripeClient(platform?: App.Platform) {
  const runtime = runtimeEnv(platform);
  if (!runtime.STRIPE_SECRET_KEY)
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(runtime.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

export function priceIdForInterval(interval: string, platform?: App.Platform) {
  const runtime = runtimeEnv(platform);
  return interval === "yearly"
    ? runtime.STRIPE_PRO_YEARLY_PRICE_ID
    : runtime.STRIPE_PRO_MONTHLY_PRICE_ID;
}

const EMPTY_PRICING: ProPricing = { monthly: null, yearly: null };
const PRICING_TTL_MS = 5 * 60 * 1000;

let pricingCache: { value: ProPricing; expiresAt: number } | null = null;

function formatAmount(amountCents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

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
    formatted: formatAmount(price.unit_amount, price.currency),
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
  if (!runtime.STRIPE_SECRET_KEY) return EMPTY_PRICING;

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

export function subscriptionProfileUpdate(status: string) {
  return {
    stripe_subscription_status: status,
    plan: status === "active" || status === "trialing" ? "pro" : "free",
  } as const;
}

export async function createCheckoutSession({
  email,
  userId,
  interval,
  platform,
}: {
  email: string;
  userId: string;
  interval: string;
  platform?: App.Platform;
}) {
  const runtime = runtimeEnv(platform);
  const price = priceIdForInterval(interval, platform);
  if (!price) throw new Error("Stripe price ID is not configured.");
  return stripeClient(platform).checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    client_reference_id: userId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${runtime.PUBLIC_SITE_URL || "http://localhost:5173"}/billing/conta?checkout=success`,
    cancel_url: `${runtime.PUBLIC_SITE_URL || "http://localhost:5173"}/precos?checkout=cancelled`,
    metadata: { user_id: userId, interval },
  });
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
