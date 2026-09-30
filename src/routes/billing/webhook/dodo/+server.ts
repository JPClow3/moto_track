import { json } from "@sveltejs/kit";
import type postgres from "postgres";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";
import { getDb } from "$server/db/client";
import {
  billingEnvironment,
  constructDodoEvent,
  dodoClient,
  intervalForProduct,
  subscriptionProfileUpdate,
  TERMINAL_SUBSCRIPTION_STATUSES,
  terminateBillingForAccount,
} from "$server/domain/billing";

type Profile = {
  owner_id: string;
  billing_provider: string | null;
  billing_environment: string | null;
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  billing_subscription_status: string | null;
  grace_until: string | null;
};

async function synchronizeSubscription(
  tx: postgres.TransactionSql,
  subscriptionId: string,
  event: UnwrapWebhookEvent,
  platform?: App.Platform,
  cancelForFinancialEvent = false,
  paymentCustomerId?: string,
) {
  const client = dodoClient(platform);
  const environment = billingEnvironment(platform);
  // Read current provider state instead of trusting event order. A delayed
  // active/renewal delivery cannot restore a cancelled subscription.
  let subscription = await client.subscriptions.retrieve(subscriptionId);
  let interval = intervalForProduct(subscription.product_id, platform);
  if (!interval) return; // Other products in the same merchant account.
  const ownerId = subscription.metadata.user_id;
  if (
    typeof ownerId !== "string" ||
    !ownerId ||
    subscription.metadata.environment !== environment ||
    subscription.metadata.app !== "moto_track"
  )
    throw new Error("Dodo subscription identity or environment mismatch.");
  await tx`select pg_advisory_xact_lock(hashtextextended(${ownerId}, 0))`;
  // A concurrent delivery may have acquired the owner lock and committed a
  // newer cancellation while this request waited. Refresh under that lock.
  subscription = await client.subscriptions.retrieve(subscriptionId);
  interval = intervalForProduct(subscription.product_id, platform);
  if (
    !interval ||
    subscription.metadata.user_id !== ownerId ||
    subscription.metadata.environment !== environment ||
    subscription.metadata.app !== "moto_track"
  )
    throw new Error("Dodo subscription linkage changed during processing.");
  const customerId = subscription.customer.customer_id;
  if (paymentCustomerId && paymentCustomerId !== customerId)
    throw new Error("Dodo financial event customer mismatch.");
  const customer = await client.customers.retrieve(customerId);
  const product = await client.products.retrieve(subscription.product_id);
  if (
    customer.business_id !== event.business_id ||
    product.business_id !== event.business_id ||
    customer.metadata?.user_id !== ownerId ||
    customer.metadata.environment !== environment ||
    subscription.quantity !== 1 ||
    subscription.on_demand ||
    subscription.payment_frequency_count !== 1 ||
    subscription.payment_frequency_interval !==
      (interval === "yearly" ? "Year" : "Month")
  )
    throw new Error("Dodo subscription/customer/product linkage mismatch.");
  const data = event.data as {
    customer?: { customer_id?: string };
    metadata?: Record<string, unknown>;
    subscription_id?: string;
  };
  if (data.customer?.customer_id && data.customer.customer_id !== customerId)
    throw new Error("Dodo webhook customer mismatch.");
  if (data.metadata?.user_id && data.metadata.user_id !== ownerId)
    throw new Error("Dodo webhook owner mismatch.");
  const [deleted] = await tx<Array<{ deleted: boolean }>>`
    select exists (
      select 1 from account_deletion_tombstones
      where owner_id = ${ownerId}
        or (billing_provider = 'dodo' and billing_environment = ${environment}
          and (billing_customer_id = ${customerId} or billing_subscription_id = ${subscriptionId}))
    ) as deleted
  `;
  if (deleted?.deleted) {
    await terminateBillingForAccount(
      { customerId, subscriptionId, environment },
      platform,
    );
    return;
  }
  const [profile] = await tx<Profile[]>`
    select owner_id, billing_provider, billing_environment, billing_customer_id,
      billing_subscription_id, billing_subscription_status, grace_until
    from subscription_profiles where owner_id = ${ownerId} for update
  `;
  // Only our authenticated checkout can establish the customer binding. Never
  // upsert an owner based only on metadata written through the merchant API.
  if (
    !profile ||
    profile.billing_provider !== "dodo" ||
    profile.billing_environment !== environment ||
    profile.billing_customer_id !== customerId
  )
    throw new Error("Dodo webhook has no matching checkout customer binding.");
  if (
    profile.billing_subscription_id &&
    profile.billing_subscription_id !== subscriptionId
  ) {
    if (TERMINAL_SUBSCRIPTION_STATUSES.includes(subscription.status)) return;
    if (cancelForFinancialEvent) {
      // A financial event for a previous subscription may stop that old billing,
      // but must never revoke a later, independently purchased subscription.
      const stopped = await client.subscriptions.update(subscriptionId, {
        status: "cancelled",
        cancel_at_next_billing_date: false,
        cancel_reason: "cancelled_by_merchant",
      });
      if (stopped.status !== "cancelled")
        throw new Error("Financial event cancellation failed.");
      return;
    }
    const previous = await client.subscriptions.retrieve(
      profile.billing_subscription_id,
    );
    if (!TERMINAL_SUBSCRIPTION_STATUSES.includes(previous.status))
      throw new Error("Multiple open subscriptions for this billing account.");
  }
  if (
    cancelForFinancialEvent &&
    !TERMINAL_SUBSCRIPTION_STATUSES.includes(subscription.status)
  ) {
    const stopped = await client.subscriptions.update(subscriptionId, {
      status: "cancelled",
      cancel_at_next_billing_date: false,
      cancel_reason: "cancelled_by_merchant",
    });
    if (stopped.status !== "cancelled")
      throw new Error("Financial event cancellation failed.");
    subscription = await client.subscriptions.retrieve(subscriptionId);
    if (subscription.status !== "cancelled")
      throw new Error("Financial event cancellation is not confirmed.");
  }
  const update = subscriptionProfileUpdate(
    subscription,
    interval,
    environment,
    profile.billing_subscription_id === subscriptionId
      ? profile.grace_until
      : null,
  );
  await tx`
    update subscription_profiles set ${tx(update)} where owner_id = ${ownerId}
  `;
}

async function processEvent(
  tx: postgres.TransactionSql,
  event: UnwrapWebhookEvent,
  platform?: App.Platform,
) {
  if (event.type.startsWith("subscription.")) {
    const data = event.data as { subscription_id?: string };
    if (!data.subscription_id)
      throw new Error("Dodo webhook subscription ID missing.");
    await synchronizeSubscription(tx, data.subscription_id, event, platform);
  } else if (
    ["payment.succeeded", "payment.failed", "payment.cancelled"].includes(
      event.type,
    ) ||
    event.type === "refund.succeeded" ||
    event.type.startsWith("dispute.")
  ) {
    const client = dodoClient(platform);
    const data = event.data as { payment_id?: string };
    let paymentId = data.payment_id;
    let cancelSubscription = false;
    if (event.type === "refund.succeeded") {
      const refund = await client.refunds.retrieve(
        (event.data as { refund_id: string }).refund_id,
      );
      if (
        refund.business_id !== event.business_id ||
        refund.payment_id !== paymentId
      )
        throw new Error("Dodo refund linkage mismatch.");
      if (refund.status !== "succeeded" || refund.is_partial) return;
      cancelSubscription = true;
      paymentId = refund.payment_id;
    } else if (event.type.startsWith("dispute.")) {
      const dispute = await client.disputes.retrieve(
        (event.data as { dispute_id: string }).dispute_id,
      );
      if (
        dispute.business_id !== event.business_id ||
        dispute.payment_id !== paymentId
      )
        throw new Error("Dodo dispute linkage mismatch.");
      // A won/cancelled dispute does not reopen a subscription already stopped
      // by the merchant's refund/dispute policy. A new purchase is required.
      cancelSubscription = !["dispute_won", "dispute_cancelled"].includes(
        dispute.dispute_status,
      );
      paymentId = dispute.payment_id;
    }
    if (!paymentId) throw new Error("Dodo webhook payment ID missing.");
    const payment = await client.payments.retrieve(paymentId);
    if (
      payment.business_id !== event.business_id ||
      ((event.data as { customer?: { customer_id?: string } }).customer
        ?.customer_id &&
        (event.data as { customer: { customer_id: string } }).customer
          .customer_id !== payment.customer.customer_id)
    )
      throw new Error("Dodo payment linkage mismatch.");
    const ids = new Set(payment.subscription_ids ?? []);
    if (payment.subscription_id) ids.add(payment.subscription_id);
    for (const id of ids)
      await synchronizeSubscription(
        tx,
        id,
        event,
        platform,
        cancelSubscription,
        payment.customer.customer_id,
      );
  }
}

export async function POST({ request, platform }) {
  const payload = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };
  let event: UnwrapWebhookEvent;
  let eventId: string;
  try {
    if (!headers["webhook-id"]) throw new Error("Webhook ID missing.");
    event = constructDodoEvent(payload, headers, platform);
    eventId = `dodo:${billingEnvironment(platform)}:${headers["webhook-id"]}`;
  } catch {
    return json({ error: "Webhook Error: Invalid Signature" }, { status: 400 });
  }
  const db = getDb(platform);
  try {
    await db`
      insert into billing_events (billing_event_id, billing_provider, event_type, processed_at, processing_error)
      values (${eventId}, 'dodo', ${event.type}, null, '')
      on conflict (billing_event_id) do nothing
    `;
    await db.begin(async (tx) => {
      const [stored] = await tx<Array<{ processed_at: string | Date | null }>>`
        select processed_at from billing_events where billing_event_id = ${eventId} for update
      `;
      if (!stored) throw new Error("Pending billing event disappeared.");
      if (stored.processed_at) return;
      await processEvent(tx, event, platform);
      await tx`
        update billing_events set processed_at = ${new Date().toISOString()}, processing_error = ''
        where billing_event_id = ${eventId}
      `;
    });
    return json({ received: true });
  } catch (error) {
    try {
      await db`
        update billing_events set processing_error = ${error instanceof Error ? error.message : String(error)}
        where billing_event_id = ${eventId} and processed_at is null
      `;
    } catch (recordingError) {
      console.error(
        "Failed to record Dodo webhook processing error",
        recordingError,
      );
    }
    console.error("Failed to process Dodo webhook", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
