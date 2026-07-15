import { describe, expect, it } from "vitest";
import { subscriptionProfileUpdate } from "$server/domain/billing";

describe("subscriptionProfileUpdate", () => {
  it("revokes Pro access when Stripe reports a non-entitled subscription status", () => {
    expect(subscriptionProfileUpdate("past_due")).toEqual({
      stripe_subscription_status: "past_due",
      plan: "free",
    });
  });

  it("retains Pro access while an active subscription is scheduled to cancel", () => {
    expect(subscriptionProfileUpdate("active")).toEqual({
      stripe_subscription_status: "active",
      plan: "pro",
    });
  });
});
