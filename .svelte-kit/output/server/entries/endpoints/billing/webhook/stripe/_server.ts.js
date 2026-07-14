import { json } from "@sveltejs/kit";
import { c as createSupabaseAdminClient } from "../../../../../chunks/admin.js";
import { b as constructStripeEvent } from "../../../../../chunks/billing.js";
async function POST({ request, platform }) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  let event;
  try {
    event = constructStripeEvent(payload, signature, platform);
  } catch {
    return json({ error: "Webhook Error: Invalid Signature" }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient(platform);
  await supabase.from("billing_events").upsert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event,
    processed_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.user_id || session.client_reference_id;
    if (userId) {
      const interval = session.metadata?.interval === "yearly" ? "yearly" : "monthly";
      await supabase.from("subscription_profiles").upsert({
        owner_id: userId,
        plan: "pro",
        billing_interval: interval,
        stripe_customer_id: String(session.customer ?? ""),
        stripe_subscription_id: String(session.subscription ?? ""),
        stripe_subscription_status: "active"
      });
    }
  }
  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.paused") {
    const subscription = event.data.object;
    await supabase.from("subscription_profiles").update({ stripe_subscription_status: subscription.status, plan: "free" }).eq("stripe_subscription_id", subscription.id);
  }
  return json({ received: true });
}
export {
  POST
};
