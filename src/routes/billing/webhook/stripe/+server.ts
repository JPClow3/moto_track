import { json } from "@sveltejs/kit";
import type Stripe from "stripe";
import { getDb } from "$server/db/client";
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

  // No session on this request (Stripe calls us directly), so we grab a raw
  // DB handle instead of `locals.db`.
  const db = getDb(platform);

  // `billing_events.stripe_event_id` is unique. Stripe retries webhook
  // deliveries, so a unique-violation (23505) here means this exact event was
  // already recorded — treat the retry as a no-op instead of processing it
  // (and its side effects) twice.
  try {
    // Built from explicit columns/values (rather than the `db({...})` object
    // helper) because `event.type` is a huge string-literal union that
    // otherwise sends postgres.js's insert-helper overload resolution down
    // the wrong path.
    await db`
      insert into billing_events (stripe_event_id, event_type, payload, processed_at)
      values (
        ${event.id},
        ${event.type},
        ${db.json(JSON.parse(JSON.stringify(event)))},
        ${new Date().toISOString()}
      )
    `;
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      return json({ received: true });
    }
    throw err;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id || session.client_reference_id;
    if (userId) {
      try {
        // owner_id is unique on subscription_profiles, so this upsert can
        // only ever touch this user's own row.
        await db`
          insert into subscription_profiles ${db({
            owner_id: userId,
            stripe_customer_id: String(session.customer ?? ""),
            stripe_subscription_id: String(session.subscription ?? ""),
          })}
          on conflict (owner_id) do update set
            stripe_customer_id = excluded.stripe_customer_id,
            stripe_subscription_id = excluded.stripe_subscription_id
        `;
      } catch (err) {
        // Swallowed — matches the previous Supabase upsert, whose result was
        // never checked for `.error` either.
        console.error("Failed to record Stripe customer on checkout", err);
      }
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    let ownerId = subscription.metadata?.user_id ?? "";
    if (!ownerId) {
      try {
        // Resolve the owner strictly by this subscription's id, so one
        // customer's event can never resolve to (and update) another
        // customer's subscription_profiles row.
        const [profile] = await db<Array<{ owner_id: string }>>`
          select owner_id from subscription_profiles
          where stripe_subscription_id = ${subscription.id}
        `;
        ownerId = profile?.owner_id ?? "";
      } catch {
        ownerId = "";
      }
    }
    if (ownerId) {
      const update = subscriptionProfileUpdate(subscription);
      try {
        await db`
          insert into subscription_profiles ${db({
            owner_id: ownerId,
            ...update,
          })}
          on conflict (owner_id) do update set
            stripe_subscription_status = excluded.stripe_subscription_status,
            plan = excluded.plan,
            stripe_customer_id = excluded.stripe_customer_id,
            stripe_subscription_id = excluded.stripe_subscription_id,
            billing_interval = excluded.billing_interval,
            cancel_at_period_end = excluded.cancel_at_period_end,
            current_period_end = excluded.current_period_end
        `;
      } catch (err) {
        // Swallowed — matches the previous unchecked Supabase upsert.
        console.error("Failed to sync subscription_profiles", err);
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionRef = invoice.parent?.subscription_details?.subscription;
    const subscriptionId =
      typeof subscriptionRef === "string"
        ? subscriptionRef
        : subscriptionRef?.id;
    if (subscriptionId) {
      try {
        // Scoped by stripe_subscription_id, so this can only ever update the
        // one customer's row whose subscription actually failed to invoice.
        await db`
          update subscription_profiles
          set plan = 'free', stripe_subscription_status = 'past_due'
          where stripe_subscription_id = ${subscriptionId}
        `;
      } catch (err) {
        // Swallowed — matches the previous unchecked Supabase update.
        console.error("Failed to mark subscription past_due", err);
      }
    }
  }

  return json({ received: true });
}
