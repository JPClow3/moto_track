import { describe, expect, it } from "vitest";
import {
  buildCheckoutSessionParams,
  parseBillingInterval,
  PRO_TRIAL_DAYS,
  subscriptionProfileUpdate,
} from "$server/domain/billing";

describe("Stripe billing", () => {
  it("limits checkout intervals to the configured monthly and yearly Prices", () => {
    expect(parseBillingInterval("monthly")).toBe("monthly");
    expect(parseBillingInterval("yearly")).toBe("yearly");
    expect(parseBillingInterval("weekly")).toBe("monthly");
    expect(parseBillingInterval(null)).toBe("monthly");
  });

  it("starts a seven-day trial on the selected auto-renewing Price", () => {
    expect(PRO_TRIAL_DAYS).toBe(7);
    const params = buildCheckoutSessionParams({
      email: "rider@example.com",
      userId: "user_123",
      interval: "yearly",
      priceId: "price_yearly",
      siteUrl: "https://moto-track.net",
    });
    expect(params).toMatchObject({
      mode: "subscription",
      payment_method_collection: "always",
      customer_email: "rider@example.com",
      line_items: [{ price: "price_yearly", quantity: 1 }],
      success_url: "https://moto-track.net/billing/conta?checkout=success",
      cancel_url: "https://moto-track.net/precos?checkout=cancelled",
      subscription_data: {
        trial_period_days: 7,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: { user_id: "user_123", interval: "yearly" },
      },
    });
    expect(params.payment_method_types).toBeUndefined();
  });

  it("does not restart the free trial for an existing Stripe customer", () => {
    const params = buildCheckoutSessionParams({
      email: "rider@example.com",
      userId: "user_123",
      customerId: "cus_existing",
      interval: "monthly",
      priceId: "price_monthly",
      siteUrl: "https://moto-track.net",
    });
    expect(params.customer).toBe("cus_existing");
    expect(params.subscription_data).toMatchObject({
      metadata: { user_id: "user_123", interval: "monthly" },
    });
    expect(params.subscription_data?.trial_period_days).toBeUndefined();
    expect(params.subscription_data?.trial_settings).toBeUndefined();
  });

  it("keeps Pro during past_due and opens a grace window", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    expect(
      subscriptionProfileUpdate(
        {
          id: "sub_past_due",
          customer: "cus_123",
          status: "past_due",
          cancel_at_period_end: false,
          items: {
            data: [
              {
                price: { recurring: { interval: "month" } },
                current_period_end: 1_800_000_000,
              },
            ],
          },
        },
        now,
      ),
    ).toEqual({
      stripe_subscription_status: "past_due",
      plan: "pro",
      grace_until: "2026-07-26T12:00:00.000Z",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_past_due",
      billing_interval: "monthly",
      cancel_at_period_end: false,
      current_period_end: "2027-01-15T08:00:00.000Z",
    });
  });

  it("keeps Pro access until the end of an active annual subscription", () => {
    expect(
      subscriptionProfileUpdate({
        id: "sub_active",
        customer: "cus_456",
        status: "active",
        cancel_at_period_end: true,
        items: {
          data: [
            {
              price: { recurring: { interval: "year" } },
              current_period_end: 1_800_000_000,
            },
          ],
        },
      }),
    ).toEqual({
      stripe_subscription_status: "active",
      plan: "pro",
      grace_until: null,
      stripe_customer_id: "cus_456",
      stripe_subscription_id: "sub_active",
      billing_interval: "yearly",
      cancel_at_period_end: true,
      current_period_end: "2027-01-15T08:00:00.000Z",
    });
  });

  it("grants Pro during a Stripe trial", () => {
    expect(
      subscriptionProfileUpdate({
        id: "sub_trialing",
        customer: "cus_trial",
        status: "trialing",
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: { recurring: { interval: "month" } },
              current_period_end: 1_800_000_000,
            },
          ],
        },
      }),
    ).toMatchObject({
      stripe_subscription_status: "trialing",
      plan: "pro",
      grace_until: null,
      billing_interval: "monthly",
    });
  });
});
