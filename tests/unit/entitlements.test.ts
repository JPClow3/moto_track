import { describe, expect, it } from "vitest";
import {
  hasProAccess,
  remainingFreeSlots,
} from "../../src/lib/server/domain/entitlements";

describe("entitlements", () => {
  it("grants active pro access", () => {
    expect(
      hasProAccess({
        plan: "pro",
        billing_provider: "dodo",
        billing_environment: "live_mode",
        billing_subscription_status: "active",
      }),
    ).toBe(true);
  });

  it("computes remaining free slots", () => {
    expect(remainingFreeSlots({ hasPro: false, limit: 3, used: 2 })).toBe(1);
    expect(remainingFreeSlots({ hasPro: true, limit: 3, used: 99 })).toBeNull();
  });

  it("honours grace_until for past_due Pro profiles", () => {
    expect(
      hasProAccess({
        plan: "pro",
        billing_provider: "dodo",
        billing_environment: "live_mode",
        billing_subscription_status: "past_due",
        grace_until: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      hasProAccess({
        plan: "pro",
        billing_provider: "dodo",
        billing_environment: "live_mode",
        billing_subscription_status: "past_due",
        grace_until: "2000-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("rejects test subscriptions and grace periods in production", () => {
    for (const status of ["active", "trialing", "past_due"]) {
      expect(
        hasProAccess(
          {
            plan: "pro",
            billing_provider: "dodo",
            billing_environment: "test_mode",
            billing_subscription_status: status,
            grace_until: "2099-01-01T00:00:00Z",
          },
          new Date(),
          "live_mode",
        ),
      ).toBe(false);
    }
  });

  it("requires provider identity and explicit matching environment", () => {
    const active = { plan: "pro", billing_subscription_status: "active" };
    expect(hasProAccess(active)).toBe(false);
    expect(hasProAccess({ ...active, billing_provider: "dodo" })).toBe(false);
    expect(
      hasProAccess(
        {
          ...active,
          billing_provider: "dodo",
          billing_environment: "test_mode",
        },
        new Date(),
        "test_mode",
      ),
    ).toBe(true);
    expect(
      hasProAccess(
        {
          ...active,
          billing_provider: "dodo",
          billing_environment: "test_mode",
          entitlement_environment: "live_mode",
        },
        new Date(),
        "test_mode",
      ),
    ).toBe(false);
  });

  it("grants historical provider access only through bounded grace", () => {
    const legacy = {
      plan: "pro",
      billing_provider: "legacy",
      billing_subscription_status: "active",
    };
    expect(hasProAccess(legacy)).toBe(false);
    expect(
      hasProAccess({ ...legacy, grace_until: "2099-01-01T00:00:00Z" }),
    ).toBe(true);
    expect(
      hasProAccess({ ...legacy, grace_until: "2000-01-01T00:00:00Z" }),
    ).toBe(false);
  });
});
