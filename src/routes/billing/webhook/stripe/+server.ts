import { json } from "@sveltejs/kit";
import type Stripe from "stripe";
import { createSupabaseAdminClient } from "$server/supabase/admin";
import {
  constructStripeEvent,
  graceUntilFrom,
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

  const { data: insertedEvents, error: eventError } = await supabase
    .from("billing_events")
    .upsert(
      {
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event as never,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "stripe_event_id", ignoreDuplicates: true },
    )
    .select("id");
  if (eventError) throw eventError;
  if (!insertedEvents?.length) return json({ received: true });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id || session.client_reference_id;
    if (userId) {
      await supabase.from("subscription_profiles").upsert(
        {
          owner_id: userId,
          stripe_customer_id: String(session.customer ?? ""),
          stripe_subscription_id: String(session.subscription ?? ""),
        },
        { onConflict: "owner_id" },
      );
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    let ownerId = subscription.metadata?.user_id;
    if (!ownerId) {
      const { data: profile } = await supabase
        .from("subscription_profiles")
        .select("owner_id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();
      ownerId = profile?.owner_id ?? "";
    }
    if (ownerId)
      await supabase.from("subscription_profiles").upsert(
        {
          owner_id: ownerId,
          ...subscriptionProfileUpdate(subscription),
        },
        { onConflict: "owner_id" },
      );
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionRef = invoice.parent?.subscription_details?.subscription;
    const subscriptionId =
      typeof subscriptionRef === "string"
        ? subscriptionRef
        : subscriptionRef?.id;
    if (subscriptionId) {
      // Keep plan=pro and open a short grace window; Conta/garage use hasProAccess.
      await supabase
        .from("subscription_profiles")
        .update({
          plan: "pro",
          stripe_subscription_status: "past_due",
          grace_until: graceUntilFrom(),
        })
        .eq("stripe_subscription_id", subscriptionId);
    }
  }

  return json({ received: true });
}
