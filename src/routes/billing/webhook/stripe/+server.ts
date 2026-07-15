import { json } from "@sveltejs/kit";
import type Stripe from "stripe";
import { createSupabaseAdminClient } from "$server/supabase/admin";
import {
  constructStripeEvent,
  subscriptionProfileUpdate,
} from "$server/domain/billing";

export async function POST({ request, platform }) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = constructStripeEvent(payload, signature, platform);
  } catch {
    return json({ error: "Webhook Error: Invalid Signature" }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient(platform);

  await supabase.from("billing_events").upsert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as never,
    processed_at: new Date().toISOString(),
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id || session.client_reference_id;
    if (userId) {
      const interval =
        session.metadata?.interval === "yearly" ? "yearly" : "monthly";
      await supabase.from("subscription_profiles").upsert({
        owner_id: userId,
        plan: "pro",
        billing_interval: interval,
        stripe_customer_id: String(session.customer ?? ""),
        stripe_subscription_id: String(session.subscription ?? ""),
        stripe_subscription_status: "active",
      });
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.paused"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    await supabase
      .from("subscription_profiles")
      .update(subscriptionProfileUpdate(subscription.status))
      .eq("stripe_subscription_id", subscription.id);
  }

  return json({ received: true });
}
