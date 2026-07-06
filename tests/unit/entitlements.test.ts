import { describe, expect, it } from "vitest";
import {
  hasProAccess,
  remainingFreeSlots,
} from "../../src/lib/server/domain/entitlements";

describe("entitlements", () => {
  it("grants active pro access", () => {
    expect(
      hasProAccess({ plan: "pro", stripe_subscription_status: "active" }),
    ).toBe(true);
  });

  it("computes remaining free slots", () => {
    expect(remainingFreeSlots({ hasPro: false, limit: 3, used: 2 })).toBe(1);
    expect(remainingFreeSlots({ hasPro: true, limit: 3, used: 99 })).toBeNull();
  });
});
