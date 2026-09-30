import { describe, expect, it } from "vitest";
import type { Subscription } from "dodopayments/resources/subscriptions";
import { verifiedAccountBillingSummary } from "$server/domain/account-billing-summary";
import { isoTimestampValue } from "$server/domain/date-value";

const due = "2026-10-07T10:28:13.113Z";
const profile = {
  billing_provider: "dodo",
  billing_environment: "live_mode",
  billing_subscription_status: "active",
  billing_subscription_id: "sub_owner",
  billing_customer_id: "cus_owner",
  billing_product_id: "pdt_monthly",
  current_period_end: new Date(due),
};
const subscription = {
  subscription_id: "sub_owner",
  customer: { customer_id: "cus_owner" },
  product_id: "pdt_monthly",
  status: "active",
  metadata: { user_id: "owner", app: "moto_track", environment: "live_mode" },
  created_at: "2026-09-30T10:28:13.113Z",
  next_billing_date: due,
  trial_period_days: 7,
  tax_inclusive: true,
  recurring_pre_tax_amount: 1490,
  currency: "BRL",
  quantity: 1,
} as unknown as Subscription;
const now = Date.parse("2026-09-30T12:00:00Z");

describe("account billing presentation", () => {
  it("normalizes Postgres Date and ISO timestamps without weekday truncation", () => {
    expect(isoTimestampValue(new Date(due))).toBe(due);
    expect(isoTimestampValue(due)).toBe(due);
    expect(isoTimestampValue("invalid")).toBeNull();
    expect(isoTimestampValue(null)).toBeNull();
  });
  it("labels a verified current trial and keeps its next charge date", () => {
    expect(
      verifiedAccountBillingSummary(
        subscription,
        profile,
        "owner",
        "live_mode",
        now,
      ),
    ).toEqual({
      trialEndsAt: due,
      nextBillingAt: due,
    });
  });
  it("does not call renewed or zero-trial subscriptions a free trial", () => {
    expect(
      verifiedAccountBillingSummary(
        subscription,
        profile,
        "owner",
        "live_mode",
        Date.parse(due),
      )?.trialEndsAt,
    ).toBeNull();
    expect(
      verifiedAccountBillingSummary(
        { ...subscription, trial_period_days: 0 },
        profile,
        "owner",
        "live_mode",
        now,
      )?.trialEndsAt,
    ).toBeNull();
  });
  it("rejects another owner, environment or stale webhook profile", () => {
    expect(
      verifiedAccountBillingSummary(
        subscription,
        profile,
        "other",
        "live_mode",
        now,
      ),
    ).toBeNull();
    expect(
      verifiedAccountBillingSummary(
        subscription,
        profile,
        "owner",
        "test_mode",
        now,
      ),
    ).toBeNull();
    expect(
      verifiedAccountBillingSummary(
        subscription,
        { ...profile, current_period_end: "2026-11-07" },
        "owner",
        "live_mode",
        now,
      ),
    ).toBeNull();
    expect(
      verifiedAccountBillingSummary(
        { ...subscription, status: "cancelled" },
        profile,
        "owner",
        "live_mode",
        now,
      ),
    ).toBeNull();
  });
});
