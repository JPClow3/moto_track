import { describe, expect, it } from "vitest";
import {
  parseBillingInterval,
  subscriptionProfileUpdate,
} from "$server/domain/billing";

describe("Stripe billing", () => {
  it("limits checkout intervals to the configured monthly and yearly Prices", () => {
    expect(parseBillingInterval("monthly")).toBe("monthly");
    expect(parseBillingInterval("yearly")).toBe("yearly");
    expect(parseBillingInterval("weekly")).toBe("monthly");
    expect(parseBillingInterval(null)).toBe("monthly");
  });

  it("revokes Pro access when Stripe reports a non-entitled subscription status", () => {
    expect(
      subscriptionProfileUpdate({
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
      }),
    ).toEqual({
      stripe_subscription_status: "past_due",
      plan: "free",
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
      stripe_customer_id: "cus_456",
      stripe_subscription_id: "sub_active",
      billing_interval: "yearly",
      cancel_at_period_end: true,
      current_period_end: "2027-01-15T08:00:00.000Z",
    });
  });
});
