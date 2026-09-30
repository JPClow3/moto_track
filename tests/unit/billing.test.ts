import { describe, expect, it } from "vitest";
import type { Subscription } from "dodopayments/resources/subscriptions";
import {
  buildCheckoutSessionParams,
  parseBillingInterval,
  PRO_TRIAL_DAYS,
  subscriptionProfileUpdate,
} from "$server/domain/billing";

function subscription(status: Subscription["status"] = "active"): Subscription {
  return {
    subscription_id: "sub_owner",
    customer: { customer_id: "cus_owner" },
    product_id: "pdt_monthly",
    status,
    cancel_at_next_billing_date: false,
    next_billing_date: "2026-10-20T12:00:00.000Z",
  } as Subscription;
}

describe("Dodo billing", () => {
  it("limits intervals to the monthly/yearly catalog", () => {
    expect(parseBillingInterval("yearly")).toBe("yearly");
    expect(parseBillingInterval("weekly")).toBe("monthly");
    expect(parseBillingInterval(null)).toBe("monthly");
  });
  it("sets an explicit seven-day first trial and links checkout identity", () => {
    expect(PRO_TRIAL_DAYS).toBe(7);
    expect(
      buildCheckoutSessionParams({
        email: "rider@example.com",
        userId: "owner",
        customerId: "cus_owner",
        interval: "yearly",
        productId: "pdt_yearly",
        siteUrl: "https://moto-track.net",
        environment: "live_mode",
        trialEligible: true,
      }),
    ).toMatchObject({
      product_cart: [{ product_id: "pdt_yearly", quantity: 1 }],
      billing_currency: "BRL",
      customer: { customer_id: "cus_owner" },
      subscription_data: { trial_period_days: 7 },
      metadata: {
        user_id: "owner",
        environment: "live_mode",
        interval: "yearly",
        app: "moto_track",
      },
      return_url: "https://moto-track.net/billing/conta?checkout=returned",
      feature_flags: { allow_customer_editing_email: false },
    });
  });
  it("explicitly overrides product trial to zero for returning customers", () => {
    expect(
      buildCheckoutSessionParams({
        email: "rider@example.com",
        userId: "owner",
        customerId: "cus_owner",
        interval: "monthly",
        productId: "pdt_monthly",
        siteUrl: "https://moto-track.net",
        environment: "live_mode",
      }).subscription_data?.trial_period_days,
    ).toBe(0);
  });
  it("keeps active scheduled cancellation entitled until the provider ends it", () => {
    const record = subscription();
    record.cancel_at_next_billing_date = true;
    expect(
      subscriptionProfileUpdate(record, "yearly", "live_mode"),
    ).toMatchObject({
      billing_provider: "dodo",
      billing_environment: "live_mode",
      billing_subscription_status: "active",
      billing_customer_id: "cus_owner",
      billing_subscription_id: "sub_owner",
      billing_product_id: "pdt_monthly",
      plan: "pro",
      billing_interval: "yearly",
      cancel_at_period_end: true,
      current_period_end: "2026-10-20T12:00:00.000Z",
      grace_until: null,
    });
  });
  it.each([
    "pending",
    "on_hold",
    "paused",
    "cancelled",
    "failed",
    "expired",
  ] as const)("revokes Pro for %s", (status) => {
    expect(
      subscriptionProfileUpdate(subscription(status), "monthly", "test_mode"),
    ).toMatchObject({ plan: "free", grace_until: null });
  });
  it("anchors failed-payment grace to the billing due date, not delivery time", () => {
    expect(
      subscriptionProfileUpdate(
        subscription("past_due"),
        "monthly",
        "live_mode",
        null,
        new Date("2026-10-25T12:00:00.000Z"),
      ),
    ).toMatchObject({ plan: "pro", grace_until: "2026-10-23T12:00:00.000Z" });
  });
  it("never extends an already opened grace period on repeated failure events", () => {
    expect(
      subscriptionProfileUpdate(
        subscription("past_due"),
        "monthly",
        "live_mode",
        "2026-10-19T12:00:00.000Z",
        new Date("2026-10-21T12:00:00.000Z"),
      ).grace_until,
    ).toBe("2026-10-19T12:00:00.000Z");
  });
  it("honours an earlier provider grace deadline", () => {
    const record = {
      ...subscription("past_due"),
      past_due_ends_at: "2026-10-21T12:00:00.000Z",
    };
    expect(
      subscriptionProfileUpdate(
        record,
        "monthly",
        "live_mode",
        null,
        new Date("2026-10-20T12:00:00Z"),
      ).grace_until,
    ).toBe("2026-10-21T12:00:00.000Z");
  });
});
