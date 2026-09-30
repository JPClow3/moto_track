import DodoPayments from "dodopayments";
import type { Subscription } from "dodopayments/resources/subscriptions";
import type { Product } from "dodopayments/resources/products";
import type { CheckoutSessionCreateParams } from "dodopayments/resources/checkout-sessions";
import { runtimeEnv } from "$server/runtime";
import type { PlanPrice, ProPricing } from "$types/billing";

export type { PlanPrice, ProPricing };
export type BillingInterval = "monthly" | "yearly";
export type BillingEnvironment = "test_mode" | "live_mode";
export const PRO_TRIAL_DAYS = 7;
export const PAYMENT_FAILURE_GRACE_DAYS = 3;
// Hosted sessions (confirm:false) expire after 24 hours per the provider:
// https://docs.dodopayments.com/developer-resources/checkout-session
export const DODO_CHECKOUT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function checkoutSessionHasExpired(
  createdAt: string | Date | null | undefined,
  now = Date.now(),
) {
  const created =
    createdAt instanceof Date
      ? createdAt.getTime()
      : Date.parse(createdAt ?? "");
  return (
    Number.isFinite(created) && now > created + DODO_CHECKOUT_SESSION_TTL_MS
  );
}

async function assertCheckoutPaymentTerminal(
  paymentId: string,
  customerId: string,
  platform?: App.Platform,
) {
  const payment = await dodoClient(platform).payments.retrieve(paymentId);
  if (
    payment.customer.customer_id !== customerId ||
    !["failed", "cancelled"].includes(payment.status ?? "")
  )
    throw new Error(
      "Previous checkout payment is not confirmed failed or cancelled.",
    );
}

export async function assertExpiredCheckoutCanBeReplaced(
  {
    customerId,
    createdAt,
    paymentId,
  }: {
    customerId: string;
    createdAt: string | Date;
    paymentId?: string | null;
  },
  platform?: App.Platform,
) {
  if (!checkoutSessionHasExpired(createdAt))
    throw new Error("Previous checkout has not expired.");
  if (paymentId) {
    await assertCheckoutPaymentTerminal(paymentId, customerId, platform);
    return;
  }
  // A purged session cannot disclose whether a payment started before expiry.
  // Enumerate all pages, then retrieve each canonical payment. Any settlement,
  // processing, unknown state or provider failure blocks a replacement.
  for await (const payment of dodoClient(platform).payments.list({
    customer_id: customerId,
    created_at_gte:
      createdAt instanceof Date
        ? createdAt.toISOString()
        : new Date(createdAt).toISOString(),
  })) {
    if (payment.customer.customer_id !== customerId)
      throw new Error("Dodo payment customer filter mismatch.");
    await assertCheckoutPaymentTerminal(
      payment.payment_id,
      customerId,
      platform,
    );
  }
}

function configured(value: string | undefined): value is string {
  return Boolean(value && !/(?:replace[-_ ]?me|placeholder)/i.test(value));
}

export function billingEnvironment(
  platform?: App.Platform,
): BillingEnvironment {
  const value = runtimeEnv(platform).DODO_PAYMENTS_ENVIRONMENT;
  if (value !== "test_mode" && value !== "live_mode")
    throw new Error(
      "DODO_PAYMENTS_ENVIRONMENT must be test_mode or live_mode.",
    );
  return value;
}

export function dodoClient(platform?: App.Platform) {
  const runtime = runtimeEnv(platform);
  if (!configured(runtime.DODO_PAYMENTS_API_KEY))
    throw new Error("DODO_PAYMENTS_API_KEY is not configured.");
  return new DodoPayments({
    bearerToken: runtime.DODO_PAYMENTS_API_KEY,
    environment: billingEnvironment(platform),
    webhookKey: runtime.DODO_PAYMENTS_WEBHOOK_SECRET,
  });
}

export function parseBillingInterval(value: string | null): BillingInterval {
  return value === "yearly" ? "yearly" : "monthly";
}

export function productIdForInterval(
  interval: BillingInterval,
  platform?: App.Platform,
) {
  const runtime = runtimeEnv(platform);
  return interval === "yearly"
    ? runtime.DODO_PRO_YEARLY_PRODUCT_ID
    : runtime.DODO_PRO_MONTHLY_PRODUCT_ID;
}

export function intervalForProduct(
  productId: string,
  platform?: App.Platform,
): BillingInterval | null {
  if (productId === productIdForInterval("monthly", platform)) return "monthly";
  if (productId === productIdForInterval("yearly", platform)) return "yearly";
  return null;
}

export function productPrice(
  product: Product,
  interval: BillingInterval,
): PlanPrice | null {
  const price = product.price;
  const expected = interval === "yearly" ? "Year" : "Month";
  if (
    !product.is_recurring ||
    price.type !== "recurring_price" ||
    price.payment_frequency_interval !== expected ||
    price.payment_frequency_count !== 1 ||
    !Number.isSafeInteger(price.price) ||
    price.price < 0 ||
    price.purchasing_power_parity
  )
    return null;
  const discount = price.discount_bps ?? (price.discount ?? 0) * 100;
  if (discount < 0 || discount > 10000) return null;
  return {
    amountCents: Math.round(price.price * (1 - discount / 10000)),
    currency: price.currency.toLowerCase(),
    interval: interval === "yearly" ? "year" : "month",
  };
}

const EMPTY_PRICING: ProPricing = { monthly: null, yearly: null };
let pricingCache: { key: string; value: ProPricing; expiresAt: number } | null =
  null;

/** Read the same fixed subscription products sold by checkout. */
export async function fetchProPricing(
  platform?: App.Platform,
): Promise<ProPricing> {
  const runtime = runtimeEnv(platform);
  if (!configured(runtime.DODO_PAYMENTS_API_KEY)) return EMPTY_PRICING;
  let client: DodoPayments;
  try {
    client = dodoClient(platform);
  } catch {
    return EMPTY_PRICING;
  }
  // Private key is never logged. Account, mode and catalog changes invalidate it.
  const key = JSON.stringify([
    runtime.DODO_PAYMENTS_API_KEY,
    runtime.DODO_PAYMENTS_ENVIRONMENT,
    runtime.DODO_PRO_MONTHLY_PRODUCT_ID,
    runtime.DODO_PRO_YEARLY_PRODUCT_ID,
  ]);
  const now = Date.now();
  if (pricingCache?.key === key && pricingCache.expiresAt > now)
    return pricingCache.value;
  const retrieve = async (interval: BillingInterval) => {
    const id = productIdForInterval(interval, platform);
    if (!configured(id)) return null;
    return productPrice(await client.products.retrieve(id), interval);
  };
  const [monthly, yearly] = await Promise.allSettled([
    retrieve("monthly"),
    retrieve("yearly"),
  ]);
  const value = {
    monthly: monthly.status === "fulfilled" ? monthly.value : null,
    yearly: yearly.status === "fulfilled" ? yearly.value : null,
  };
  if (value.monthly || value.yearly)
    pricingCache = { key, value, expiresAt: now + 300_000 };
  return value;
}

export function graceUntilFrom(now = new Date()) {
  return new Date(
    now.getTime() + PAYMENT_FAILURE_GRACE_DAYS * 86_400_000,
  ).toISOString();
}

export function subscriptionProfileUpdate(
  subscription: Subscription,
  interval: BillingInterval,
  environment: BillingEnvironment,
  existingGrace?: string | null,
  now = new Date(),
) {
  const pastDue = subscription.status === "past_due";
  const dueDate = Date.parse(subscription.next_billing_date);
  const grace = graceUntilFrom(
    new Date(
      Math.min(
        now.getTime(),
        Number.isFinite(dueDate) ? dueDate : now.getTime(),
      ),
    ),
  );
  const previous = existingGrace ? Date.parse(existingGrace) : NaN;
  const providerDeadline = Date.parse(
    (
      subscription as Subscription & {
        past_due_ends_at?: string | null;
      }
    ).past_due_ends_at ?? "",
  );
  const graceEnd = new Date(
    Math.min(
      ...[Date.parse(grace), previous, providerDeadline].filter(
        Number.isFinite,
      ),
    ),
  ).toISOString();
  return {
    billing_provider: "dodo",
    billing_environment: environment,
    billing_subscription_status: subscription.status,
    plan: subscription.status === "active" || pastDue ? "pro" : "free",
    grace_until: pastDue ? graceEnd : null,
    billing_customer_id: subscription.customer.customer_id,
    billing_subscription_id: subscription.subscription_id,
    billing_product_id: subscription.product_id,
    billing_interval: interval,
    cancel_at_period_end: subscription.cancel_at_next_billing_date,
    current_period_end: Number.isFinite(dueDate)
      ? new Date(dueDate).toISOString()
      : null,
  } as const;
}

export class ExistingSubscriptionError extends Error {}
export const TERMINAL_SUBSCRIPTION_STATUSES = [
  "cancelled",
  "failed",
  "expired",
];

/** Auto-pagination prevents missing an older active subscription. */
export async function customerSubscriptionHistory(
  customerId: string,
  platform?: App.Platform,
) {
  const history = [];
  for await (const subscription of dodoClient(platform).subscriptions.list({
    customer_id: customerId,
  })) {
    if (subscription.customer.customer_id !== customerId)
      throw new Error("Dodo customer filter mismatch.");
    history.push(subscription);
  }
  return history;
}

export async function ensureBillingCustomer({
  email,
  userId,
  customerId,
  platform,
}: {
  email: string;
  userId: string;
  customerId?: string;
  platform?: App.Platform;
}) {
  const client = dodoClient(platform);
  const environment = billingEnvironment(platform);
  if (customerId) {
    const customer = await client.customers.retrieve(customerId);
    if (customer.blocked_at)
      throw new Error("Dodo customer is blocked for billing.");
    if (
      customer.metadata?.user_id !== userId ||
      customer.metadata?.environment !== environment ||
      customer.metadata?.app !== "moto_track"
    )
      throw new Error("Dodo customer identity mismatch.");
    return customer;
  }
  // Dodo ignores the SDK's generic idempotencyKey option. Recover a successful
  // customer creation after a lost response by exact merchant-owned identity.
  const matching = [];
  for await (const customer of client.customers.list({ email })) {
    if (
      customer.email.toLowerCase() === email.toLowerCase() &&
      customer.metadata?.user_id === userId &&
      customer.metadata.environment === environment &&
      customer.metadata.app === "moto_track"
    )
      matching.push(customer);
  }
  if (matching.length > 1)
    throw new Error("Multiple Dodo customers match this billing account.");
  if (matching.length === 1) {
    if (matching[0].blocked_at)
      throw new Error("Dodo customer is blocked for billing.");
    return matching[0];
  }
  return client.customers.create(
    {
      email,
      name: email.split("@")[0],
      metadata: { user_id: userId, environment, app: "moto_track" },
    },
    { maxRetries: 0 },
  );
}

export function buildCheckoutSessionParams({
  email,
  userId,
  customerId,
  interval,
  productId,
  siteUrl,
  trialEligible = false,
  environment,
}: {
  email: string;
  userId: string;
  customerId?: string;
  interval: BillingInterval;
  productId: string;
  siteUrl: string;
  trialEligible?: boolean;
  environment: BillingEnvironment;
}): CheckoutSessionCreateParams {
  return {
    product_cart: [{ product_id: productId, quantity: 1 }],
    confirm: false,
    billing_currency: "BRL",
    customer: customerId
      ? { customer_id: customerId }
      : { email, name: email.split("@")[0] },
    return_url: `${siteUrl}/billing/conta?checkout=returned`,
    cancel_url: `${siteUrl}/precos?checkout=cancelled`,
    metadata: { user_id: userId, interval, environment, app: "moto_track" },
    subscription_data: {
      trial_period_days: trialEligible ? PRO_TRIAL_DAYS : 0,
    },
    feature_flags: {
      allow_customer_editing_email: false,
      allow_currency_selection: false,
    },
  };
}

export async function createCheckoutSession({
  email,
  userId,
  customerId,
  interval,
  trialEligible = false,
  checkoutKey,
  platform,
}: {
  email: string;
  userId: string;
  customerId: string;
  interval: BillingInterval;
  trialEligible?: boolean;
  checkoutKey: string;
  platform?: App.Platform;
}) {
  const runtime = runtimeEnv(platform);
  const productId = productIdForInterval(interval, platform);
  if (!configured(productId))
    throw new Error("Dodo product ID is not configured.");
  const client = dodoClient(platform);
  const product = await client.products.retrieve(productId);
  if (
    !productPrice(product, interval) ||
    product.price.type !== "recurring_price" ||
    product.price.trial_payment_method_optional ||
    product.price.zero_amount_payment_method_optional ||
    (product.price.trial_amount ?? 0) !== 0
  )
    throw new Error(
      "Dodo product must be a fixed recurring plan with a free, card-required trial.",
    );
  const history = await customerSubscriptionHistory(customerId, platform);
  if (
    history.some(
      (subscription) =>
        !TERMINAL_SUBSCRIPTION_STATUSES.includes(subscription.status),
    )
  )
    throw new ExistingSubscriptionError(
      "Customer already has an open subscription.",
    );
  return client.checkoutSessions.create(
    {
      ...buildCheckoutSessionParams({
        email,
        userId,
        customerId,
        interval,
        productId,
        siteUrl: runtime.PUBLIC_SITE_URL || "http://localhost:5173",
        environment: billingEnvironment(platform),
        trialEligible: trialEligible && history.length === 0,
      }),
      metadata: {
        user_id: userId,
        interval,
        environment: billingEnvironment(platform),
        app: "moto_track",
        checkout_attempt_id: checkoutKey,
      },
    },
    { maxRetries: 0 },
  );
}

export async function createPortalSession(
  customerId: string,
  platform?: App.Platform,
) {
  return dodoClient(platform).customers.customerPortal.create(customerId, {
    return_url: `${runtimeEnv(platform).PUBLIC_SITE_URL || "http://localhost:5173"}/billing/conta`,
    send_email: false,
  });
}

function missingResource(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  );
}

function normalizedBillingEmail(email: string) {
  const [local, domain] = email.trim().toLowerCase().split("@");
  return `${local.split("+")[0]}@${domain}`;
}

async function assertAccountBlockScope(
  customerId: string,
  platform?: App.Platform,
) {
  const client = dodoClient(platform);
  const target = await client.customers.retrieve(customerId);
  if (
    target.metadata?.app !== "moto_track" ||
    target.metadata.environment !== billingEnvironment(platform)
  )
    throw new Error("Dodo account billing block identity mismatch.");
  const customers = new Map([[customerId, target]]);
  // Dodo's block is business-wide, including aliases of the same email. An
  // account shared with another product must be resolved by an operator.
  for await (const candidate of client.customers.list()) {
    if (
      normalizedBillingEmail(candidate.email) ===
      normalizedBillingEmail(target.email)
    ) {
      if (
        candidate.customer_id !== customerId &&
        (candidate.metadata?.app !== "moto_track" ||
          candidate.metadata.user_id !== target.metadata.user_id)
      )
        throw new Error(
          "Dodo email is shared with another billing account; operator review required.",
        );
      customers.set(candidate.customer_id, candidate);
    }
  }
  for (const candidate of customers.values()) {
    for (const subscription of await customerSubscriptionHistory(
      candidate.customer_id,
      platform,
    )) {
      if (
        !TERMINAL_SUBSCRIPTION_STATUSES.includes(subscription.status) &&
        (!intervalForProduct(subscription.product_id, platform) ||
          subscription.metadata.app !== "moto_track" ||
          subscription.metadata.user_id !== target.metadata.user_id)
      )
        throw new Error(
          "Dodo email has billing outside Moto Track; operator review required.",
        );
    }
  }
}

async function blockAccountCustomer(
  customerId: string,
  platform?: App.Platform,
) {
  const client = dodoClient(platform);
  try {
    return await client.blocklist.customers.create({
      customer_id: customerId,
      reason: "Moto Track account deletion",
    });
  } catch (error) {
    // Dodo returns this specific conflict when an existing active block has
    // already swept its subscriptions. Other conflicts/failures must propagate.
    const failure = error as {
      status?: number;
      error?: { code?: string };
    } | null;
    if (
      failure?.status !== 409 ||
      failure.error?.code !== "CUSTOMER_ALREADY_BLOCKED"
    )
      throw error;
    const customer = await client.customers.retrieve(customerId);
    if (
      customer.customer_id !== customerId ||
      !customer.blocked_at ||
      !customer.blocklist_entry_id ||
      customer.metadata?.app !== "moto_track" ||
      customer.metadata.environment !== billingEnvironment(platform)
    )
      throw new Error(
        "Existing Dodo account billing block could not be verified.",
      );
    const block = await client.blocklist.customers.retrieve(
      customer.blocklist_entry_id,
    );
    if (
      block.id !== customer.blocklist_entry_id ||
      block.customer_id !== customerId ||
      block.unblocked_at ||
      normalizedBillingEmail(block.customer_email) !==
        normalizedBillingEmail(customer.email)
    )
      throw new Error("Existing Dodo account billing block linkage mismatch.");
    // The documented 409 means the block's provider sweep is complete. The
    // caller still enumerates/cancels and verifies current subscriptions below.
    return { ...block, subscriptions_swept: true };
  }
}

/** Stop every subscription; the provider has no customer-delete endpoint. */
export async function terminateBillingForAccount(
  {
    customerId,
    subscriptionId,
    environment,
  }: {
    customerId?: string | null;
    subscriptionId?: string | null;
    environment?: string | null;
  },
  platform?: App.Platform,
) {
  if (!customerId?.trim() && !subscriptionId?.trim()) return;
  if (environment !== billingEnvironment(platform))
    throw new Error("Billing termination environment mismatch.");
  const client = dodoClient(platform);
  let customer = customerId?.trim() ?? "";
  if (subscriptionId?.trim()) {
    try {
      const known = await client.subscriptions.retrieve(subscriptionId.trim());
      if (customer && known.customer.customer_id !== customer)
        throw new Error("Billing termination customer mismatch.");
      customer ||= known.customer.customer_id;
    } catch (error) {
      if (missingResource(error)) {
        if (!customer) return;
      } else {
        throw error;
      }
    }
  }
  if (customer) await assertAccountBlockScope(customer, platform);
  // A provider block also stops outstanding checkout links and future renewals.
  // It applies to the email; re-registration requires operator review.
  let block = customer ? await blockAccountCustomer(customer, platform) : null;
  if (block && (block.customer_id !== customer || block.unblocked_at))
    throw new Error("Dodo account billing block could not be verified.");
  const ids = new Set<string>();
  if (subscriptionId?.trim()) ids.add(subscriptionId.trim());
  if (customer) {
    for (const subscription of await customerSubscriptionHistory(
      customer,
      platform,
    )) {
      if (!TERMINAL_SUBSCRIPTION_STATUSES.includes(subscription.status))
        ids.add(subscription.subscription_id);
    }
  }
  for (const id of ids) {
    try {
      const subscription = await client.subscriptions.retrieve(id);
      if (customer && subscription.customer.customer_id !== customer)
        throw new Error("Billing termination customer mismatch.");
      if (TERMINAL_SUBSCRIPTION_STATUSES.includes(subscription.status))
        continue;
      if (
        !intervalForProduct(subscription.product_id, platform) ||
        subscription.metadata.app !== "moto_track"
      )
        throw new Error(
          "Refusing to cancel a subscription outside Moto Track.",
        );
      const cancelled = await client.subscriptions.update(id, {
        status: "cancelled",
        cancel_at_next_billing_date: false,
        cancel_reason: "cancelled_by_merchant",
      });
      if (cancelled.status !== "cancelled")
        throw new Error("Dodo did not cancel the subscription.");
    } catch (error) {
      if (!missingResource(error)) throw error;
    }
  }
  if (customer) {
    const remaining = await customerSubscriptionHistory(customer, platform);
    if (
      remaining.some(
        (subscription) =>
          !TERMINAL_SUBSCRIPTION_STATUSES.includes(subscription.status),
      )
    )
      throw new Error("Dodo customer still has an open subscription.");
    if (block?.subscriptions_swept !== true) {
      block = await blockAccountCustomer(customer, platform);
      if (
        block.subscriptions_swept !== true ||
        block.customer_id !== customer ||
        block.unblocked_at
      )
        throw new Error("Dodo account billing block sweep is incomplete.");
    }
    if (!block) throw new Error("Dodo account billing block is missing.");
    const verified = await client.blocklist.customers.retrieve(block.id);
    if (verified.customer_id !== customer || verified.unblocked_at)
      throw new Error("Dodo account billing block is not active.");
  }
}

export function constructDodoEvent(
  payload: string,
  headers: Record<string, string>,
  platform?: App.Platform,
) {
  const secret = runtimeEnv(platform).DODO_PAYMENTS_WEBHOOK_SECRET;
  if (!configured(secret))
    throw new Error("DODO_PAYMENTS_WEBHOOK_SECRET is not configured.");
  return dodoClient(platform).webhooks.unwrap(payload, {
    headers,
    key: secret,
  });
}
