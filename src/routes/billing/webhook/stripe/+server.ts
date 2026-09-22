import { json } from "@sveltejs/kit";
import type Stripe from "stripe";
import type postgres from "postgres";
import { getDb } from "$server/db/client";
import {
  constructStripeEvent,
  graceUntilFrom,
  subscriptionProfileUpdate,
} from "$server/domain/billing";

function processingErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function processEvent(tx: postgres.TransactionSql, event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id || session.client_reference_id;
    if (userId) {
      await tx`
        insert into subscription_profiles ${tx({
          owner_id: userId,
          stripe_customer_id: String(session.customer ?? ""),
          stripe_subscription_id: String(session.subscription ?? ""),
        })}
        on conflict (owner_id) do update set
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_subscription_id = excluded.stripe_subscription_id
      `;
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
      // Resolve the owner strictly by this subscription's id. This query and
      // the ensuing upsert share the event transaction, so either both the
      // customer effect and processed marker commit, or neither does.
      const [profile] = await tx<Array<{ owner_id: string }>>`
        select owner_id from subscription_profiles
        where stripe_subscription_id = ${subscription.id}
      `;
      ownerId = profile?.owner_id ?? "";
    }
    if (ownerId) {
      const update = subscriptionProfileUpdate(subscription);
      await tx`
        insert into subscription_profiles ${tx({
          owner_id: ownerId,
          ...update,
        })}
        on conflict (owner_id) do update set
          stripe_subscription_status = excluded.stripe_subscription_status,
          plan = excluded.plan,
          grace_until = excluded.grace_until,
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_subscription_id = excluded.stripe_subscription_id,
          billing_interval = excluded.billing_interval,
          cancel_at_period_end = excluded.cancel_at_period_end,
          current_period_end = excluded.current_period_end
      `;
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionRef =
      invoice.parent?.subscription_details?.subscription ??
      (
        invoice as unknown as {
          subscription?: string | Stripe.Subscription | null;
        }
      ).subscription;
    const subscriptionId =
      typeof subscriptionRef === "string"
        ? subscriptionRef
        : subscriptionRef?.id;
    if (subscriptionId) {
      // The subscription id scopes this update to the owner whose invoice
      // failed; the status predicate avoids reviving canceled/unpaid plans.
      await tx`
        update subscription_profiles
        set
          plan = 'pro',
          stripe_subscription_status = 'past_due',
          grace_until = ${graceUntilFrom()}
        where stripe_subscription_id = ${subscriptionId}
          and stripe_subscription_status in ('active', 'trialing', 'past_due')
      `;
    }
  }
}

export async function POST({ request, platform }) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = constructStripeEvent(payload, signature, platform);
  } catch {
    return json({ error: "Webhook Error: Invalid Signature" }, { status: 400 });
  }

  // Stripe calls this route without an application session, so use a raw,
  // request-scoped database handle rather than locals.db.
  const db = getDb(platform);
  const serializedEvent = db.json(JSON.parse(JSON.stringify(event)));

  try {
    // Persist the delivery as pending before applying any customer-visible
    // effect. ON CONFLICT intentionally retains a previous pending/failed row
    // so a Stripe retry can attempt it again.
    await db`
      insert into billing_events (
        stripe_event_id,
        event_type,
        payload,
        processed_at,
        processing_error
      ) values (
        ${event.id},
        ${event.type},
        ${serializedEvent},
        null,
        ''
      )
      on conflict (stripe_event_id) do nothing
    `;
  } catch (error) {
    console.error("Failed to persist Stripe webhook delivery", error);
    return json({ error: "Webhook persistence failed" }, { status: 500 });
  }

  try {
    await db.begin(async (tx) => {
      // Serialize duplicate deliveries for this event. A concurrent retry
      // waits here, then sees processed_at and exits without replaying effects.
      const [storedEvent] = await tx<
        Array<{ processed_at: string | Date | null }>
      >`
        select processed_at from billing_events
        where stripe_event_id = ${event.id}
        for update
      `;

      if (!storedEvent) {
        throw new Error("Pending Stripe event disappeared before processing");
      }
      if (storedEvent.processed_at) return;

      await processEvent(tx, event);
      await tx`
        update billing_events
        set processed_at = ${new Date().toISOString()}, processing_error = ''
        where stripe_event_id = ${event.id}
      `;
    });

    return json({ received: true });
  } catch (error) {
    // The failed transaction has already rolled back every side effect. Record
    // the reason separately while the row is still pending; if another retry
    // completed first, the predicate preserves its successful state.
    try {
      await db`
        update billing_events
        set processing_error = ${processingErrorMessage(error)}
        where stripe_event_id = ${event.id}
          and processed_at is null
      `;
    } catch (recordingError) {
      console.error(
        "Failed to record Stripe webhook processing error",
        recordingError,
      );
    }

    console.error("Failed to process Stripe webhook", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
