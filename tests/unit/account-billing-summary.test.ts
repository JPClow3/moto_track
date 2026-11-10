import { afterEach, describe, expect, it, vi } from "vitest";
import type { Subscription } from "dodopayments/resources/subscriptions";
import {
  fetchAccountBillingSummary,
  verifiedAccountBillingSummary,
} from "$server/domain/account-billing-summary";
import { isoTimestampValue } from "$server/domain/date-value";

vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));

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

const platform = {
  env: {
    DODO_PAYMENTS_API_KEY: "test_billing_summary_key",
    DODO_PAYMENTS_ENVIRONMENT: "live_mode",
    DODO_PRO_MONTHLY_PRODUCT_ID: "pdt_monthly",
    DODO_PRO_YEARLY_PRODUCT_ID: "pdt_yearly",
  },
} as unknown as App.Platform;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("account billing provider resilience", () => {
  it("fetches the verified summary without leaking request options into the query", async () => {
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(subscription));

    await expect(
      fetchAccountBillingSummary(profile, "owner", platform),
    ).resolves.toEqual({ trialEndsAt: null, nextBillingAt: due });

    const [input] = request.mock.calls[0];
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.pathname).toBe("/subscriptions/sub_owner");
    expect(url.search).toBe("");
  });

  it("falls back after one failed attempt instead of delaying settings with retries", async () => {
    vi.useFakeTimers();
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("Provider unavailable"));

    const result = fetchAccountBillingSummary(profile, "owner", platform);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("aborts a stalled provider after three seconds and returns the fallback", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const request = vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, options) =>
        new Promise((_resolve, reject) => {
          signal = options?.signal;
          signal?.addEventListener("abort", () =>
            reject(new DOMException("Request aborted", "AbortError")),
          );
        }),
    );

    const result = fetchAccountBillingSummary(profile, "owner", platform);
    await vi.advanceTimersByTimeAsync(2999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBeNull();
    expect(signal?.aborted).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

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
