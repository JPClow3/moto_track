import Stripe from "stripe";
import { env } from "$env/dynamic/private";
import { siteUrl } from "$server/env";

export function stripeClient() {
  if (!env.STRIPE_SECRET_KEY)
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

export function priceIdForInterval(interval: string) {
  return interval === "yearly"
    ? env.STRIPE_PRO_YEARLY_PRICE_ID
    : env.STRIPE_PRO_MONTHLY_PRICE_ID;
}

export async function createCheckoutSession({
  email,
  userId,
  interval,
}: {
  email: string;
  userId: string;
  interval: string;
}) {
  const price = priceIdForInterval(interval);
  if (!price) throw new Error("Stripe price ID is not configured.");
  return stripeClient().checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    client_reference_id: userId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${siteUrl()}/billing/conta?checkout=success`,
    cancel_url: `${siteUrl()}/precos?checkout=cancelled`,
    metadata: { user_id: userId, interval },
  });
}

export async function createPortalSession(customerId: string) {
  return stripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}/billing/conta`,
  });
}

export function constructStripeEvent(payload: string, signature: string) {
  if (!env.STRIPE_WEBHOOK_SECRET)
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return stripeClient().webhooks.constructEvent(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );
}
