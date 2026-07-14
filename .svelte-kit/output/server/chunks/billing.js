import Stripe from "stripe";
import { r as runtimeEnv } from "./runtime.js";
function stripeClient(platform) {
  const runtime = runtimeEnv(platform);
  if (!runtime.STRIPE_SECRET_KEY)
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(runtime.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}
function priceIdForInterval(interval, platform) {
  const runtime = runtimeEnv(platform);
  return interval === "yearly" ? runtime.STRIPE_PRO_YEARLY_PRICE_ID : runtime.STRIPE_PRO_MONTHLY_PRICE_ID;
}
async function createCheckoutSession({
  email,
  userId,
  interval,
  platform
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
    metadata: { user_id: userId, interval }
  });
}
async function createPortalSession(customerId, platform) {
  const runtime = runtimeEnv(platform);
  return stripeClient(platform).billingPortal.sessions.create({
    customer: customerId,
    return_url: `${runtime.PUBLIC_SITE_URL || "http://localhost:5173"}/billing/conta`
  });
}
function constructStripeEvent(payload, signature, platform) {
  const runtime = runtimeEnv(platform);
  if (!runtime.STRIPE_WEBHOOK_SECRET)
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return stripeClient(platform).webhooks.constructEvent(
    payload,
    signature,
    runtime.STRIPE_WEBHOOK_SECRET
  );
}
export {
  createPortalSession as a,
  constructStripeEvent as b,
  createCheckoutSession as c
};
