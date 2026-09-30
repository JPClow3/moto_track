import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";
const mocks = vi.hoisted(() => ({
  construct: vi.fn(),
  getDb: vi.fn(),
  retrieveSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  retrieveCustomer: vi.fn(),
  retrieveProduct: vi.fn(),
  retrievePayment: vi.fn(),
  retrieveRefund: vi.fn(),
  retrieveDispute: vi.fn(),
  terminate: vi.fn(),
}));
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));
vi.mock("$server/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("$server/domain/billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("$server/domain/billing")>()),
  constructDodoEvent: mocks.construct,
  terminateBillingForAccount: mocks.terminate,
  dodoClient: () => ({
    subscriptions: {
      retrieve: mocks.retrieveSubscription,
      update: mocks.updateSubscription,
    },
    customers: { retrieve: mocks.retrieveCustomer },
    products: { retrieve: mocks.retrieveProduct },
    payments: { retrieve: mocks.retrievePayment },
    refunds: { retrieve: mocks.retrieveRefund },
    disputes: { retrieve: mocks.retrieveDispute },
  }),
}));
import { POST } from "../../src/routes/billing/webhook/dodo/+server";
const platform = {
  env: {
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
    DODO_PRO_MONTHLY_PRODUCT_ID: "pdt_monthly",
    DODO_PRO_YEARLY_PRODUCT_ID: "pdt_yearly",
  },
} as unknown as App.Platform;
type Row = Record<string, unknown>;
type StoredEvent = { processedAt: string | null; error: string };
const canonical = (status = "active", id = "sub_owner", owner = "owner") => ({
  subscription_id: id,
  customer: { customer_id: "cus_owner" },
  product_id: "pdt_monthly",
  metadata: { user_id: owner, environment: "test_mode", app: "moto_track" },
  status,
  quantity: 1,
  on_demand: false,
  payment_frequency_count: 1,
  payment_frequency_interval: "Month",
  next_billing_date: "2026-10-20T12:00:00.000Z",
  cancel_at_next_billing_date: false,
});
function database() {
  const state = {
    events: new Map<string, StoredEvent>(),
    profiles: new Map<string, Row>([
      [
        "owner",
        {
          owner_id: "owner",
          billing_provider: "dodo",
          billing_environment: "test_mode",
          billing_customer_id: "cus_owner",
          billing_subscription_id: null,
          grace_until: null,
        },
      ],
    ]),
    deleted: new Set<string>(),
  };
  const queries: Array<{
    sql: string;
    values: unknown[];
    transaction: boolean;
  }> = [];
  let failWrite = false;
  function queryFor(current: typeof state, transaction: boolean) {
    return vi.fn((first: unknown, ...values: unknown[]) => {
      if (!Array.isArray(first)) return { __row: first };
      const sql = first.join("?").replace(/\s+/g, " ").trim().toLowerCase();
      queries.push({ sql, values, transaction });
      if (sql.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (sql.startsWith("insert into billing_events")) {
        const id = String(values[0]);
        if (!current.events.has(id))
          current.events.set(id, { processedAt: null, error: "" });
      } else if (sql.startsWith("select processed_at")) {
        const event = current.events.get(String(values[0]));
        return Promise.resolve(
          event ? [{ processed_at: event.processedAt }] : [],
        );
      } else if (sql.startsWith("select exists")) {
        return Promise.resolve([
          { deleted: current.deleted.has(String(values[0])) },
        ]);
      } else if (sql.startsWith("select owner_id")) {
        return Promise.resolve(
          current.profiles.has(String(values[0]))
            ? [current.profiles.get(String(values[0]))]
            : [],
        );
      } else if (sql.startsWith("update subscription_profiles")) {
        if (failWrite) {
          failWrite = false;
          return Promise.reject(new Error("profile write unavailable"));
        }
        const row = (values[0] as { __row: Row }).__row;
        const owner = String(values[1]);
        current.profiles.set(owner, { ...current.profiles.get(owner), ...row });
      } else if (sql.includes("set processed_at")) {
        const event = current.events.get(String(values[1]));
        if (event) {
          event.processedAt = String(values[0]);
          event.error = "";
        }
      } else if (sql.includes("set processing_error")) {
        const event = current.events.get(String(values[1]));
        if (event && !event.processedAt) event.error = String(values[0]);
      } else throw new Error(`Unexpected SQL ${sql}`);
      return Promise.resolve([]);
    });
  }
  const db = Object.assign(queryFor(state, false), {
    begin: async (callback: (tx: unknown) => Promise<unknown>) => {
      const current = {
        events: new Map(
          [...state.events].map(([id, value]) => [id, { ...value }]),
        ),
        profiles: new Map(
          [...state.profiles].map(([id, value]) => [id, { ...value }]),
        ),
        deleted: new Set(state.deleted),
      };
      const result = await callback(queryFor(current, true));
      Object.assign(state, current);
      return result;
    },
  });
  mocks.getDb.mockReturnValue(db);
  return {
    state,
    queries,
    failNextWrite: () => {
      failWrite = true;
    },
  };
}
function event(
  type = "subscription.active",
  data: Row = { subscription_id: "sub_owner" },
): UnwrapWebhookEvent {
  return {
    type,
    data,
    business_id: "bus_owner",
    timestamp: "2026-09-29T12:00:00Z",
  } as unknown as UnwrapWebhookEvent;
}
async function deliver(payload = event(), id = "evt_owner") {
  mocks.construct.mockReturnValue(payload);
  return POST({
    request: new Request("https://moto-track.net/billing/webhook/dodo", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "webhook-id": id,
        "webhook-signature": "valid",
        "webhook-timestamp": "123",
      },
    }),
    platform,
  } as Parameters<typeof POST>[0]);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.retrieveSubscription.mockImplementation(async (id) =>
    canonical("active", id),
  );
  mocks.retrieveCustomer.mockResolvedValue({
    customer_id: "cus_owner",
    business_id: "bus_owner",
    metadata: { user_id: "owner", environment: "test_mode" },
  });
  mocks.retrieveProduct.mockResolvedValue({ business_id: "bus_owner" });
  mocks.retrievePayment.mockResolvedValue({
    business_id: "bus_owner",
    customer: { customer_id: "cus_owner" },
    subscription_ids: ["sub_owner"],
  });
  mocks.terminate.mockResolvedValue(undefined);
  mocks.updateSubscription.mockImplementation(async (id) => {
    mocks.retrieveSubscription.mockImplementation(async (nextId) =>
      canonical(nextId === id ? "cancelled" : "active", nextId),
    );
    return canonical("cancelled", id);
  });
});
describe("Dodo signed webhook lifecycle", () => {
  it("rejects signatures before accessing the database", async () => {
    mocks.construct.mockImplementationOnce(() => {
      throw new Error("bad signature");
    });
    expect((await deliver()).status).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("persists pending then applies profile and success marker in one transaction", async () => {
    const db = database();
    expect((await deliver()).status).toBe(200);
    expect(db.state.profiles.get("owner")).toMatchObject({
      plan: "pro",
      billing_subscription_id: "sub_owner",
    });
    expect(
      db.state.events.get("dodo:test_mode:evt_owner")?.processedAt,
    ).toBeTruthy();
    expect(db.queries[0].transaction).toBe(false);
    expect(
      db.queries
        .filter((q) => q.sql.startsWith("update"))
        .every((q) => q.transaction),
    ).toBe(true);
  });
  it("acknowledges duplicates without replaying provider reads or profile writes", async () => {
    const db = database();
    await deliver();
    vi.clearAllMocks();
    await deliver();
    expect(mocks.retrieveSubscription).not.toHaveBeenCalled();
    expect(db.state.profiles.get("owner")?.plan).toBe("pro");
  });
  it("rolls back effects, records failure and retries a pending event", async () => {
    const db = database();
    db.failNextWrite();
    expect((await deliver()).status).toBe(500);
    expect(db.state.events.get("dodo:test_mode:evt_owner")).toEqual({
      processedAt: null,
      error: "profile write unavailable",
    });
    expect(db.state.profiles.get("owner")?.plan).toBeUndefined();
    expect((await deliver()).status).toBe(200);
    expect(db.state.events.get("dodo:test_mode:evt_owner")?.error).toBe("");
  });
  it("retries provider outages without granting access", async () => {
    const db = database();
    mocks.retrieveSubscription.mockRejectedValueOnce(
      new Error("provider unavailable"),
    );
    expect((await deliver()).status).toBe(500);
    expect(db.state.profiles.get("owner")?.plan).toBeUndefined();
    expect((await deliver()).status).toBe(200);
  });
  it("uses canonical cancelled state for a delayed active event", async () => {
    const db = database();
    mocks.retrieveSubscription.mockResolvedValue(canonical("cancelled"));
    expect((await deliver()).status).toBe(200);
    expect(db.state.profiles.get("owner")?.plan).toBe("free");
  });
  it("refreshes provider state under the owner lock before applying it", async () => {
    const db = database();
    mocks.retrieveSubscription
      .mockResolvedValueOnce(canonical("active"))
      .mockResolvedValueOnce(canonical("cancelled"));
    expect((await deliver()).status).toBe(200);
    expect(db.state.profiles.get("owner")?.plan).toBe("free");
    expect(mocks.retrieveSubscription).toHaveBeenCalledTimes(2);
  });
  it.each([
    {
      metadata: {
        user_id: "owner",
        environment: "live_mode",
        app: "moto_track",
      },
    },
    {
      metadata: {
        user_id: "other",
        environment: "test_mode",
        app: "moto_track",
      },
    },
    { customer: { customer_id: "cus_foreign" } },
    { quantity: 2 },
    { on_demand: true },
    { payment_frequency_interval: "Year" },
  ])("rejects invalid canonical linkage %j", async (changes) => {
    const db = database();
    mocks.retrieveSubscription.mockResolvedValue({
      ...canonical(),
      ...changes,
    });
    expect((await deliver()).status).toBe(500);
    expect(db.state.profiles.get("owner")?.plan).toBeUndefined();
  });
  it("ignores products outside the configured Pro catalog", async () => {
    const db = database();
    mocks.retrieveSubscription.mockResolvedValue({
      ...canonical(),
      product_id: "pdt_other_app",
    });
    expect((await deliver()).status).toBe(200);
    expect(db.state.profiles.get("owner")?.plan).toBeUndefined();
    expect(mocks.retrieveCustomer).not.toHaveBeenCalled();
  });
  it("rejects merchant-business mismatches", async () => {
    database();
    mocks.retrieveProduct.mockResolvedValue({ business_id: "bus_foreign" });
    expect((await deliver()).status).toBe(500);
  });
  it("rejects signed payload identity that differs from canonical subscription", async () => {
    const db = database();
    expect(
      (
        await deliver(
          event("subscription.active", {
            subscription_id: "sub_owner",
            customer: { customer_id: "cus_foreign" },
          }),
        )
      ).status,
    ).toBe(500);
    expect(db.state.profiles.get("owner")?.plan).toBeUndefined();
  });
  it("requires the authenticated checkout customer binding", async () => {
    const db = database();
    db.state.profiles.delete("owner");
    expect((await deliver()).status).toBe(500);
    expect(db.state.profiles.size).toBe(0);
  });
  it("does not bind a live-mode profile from a test-mode webhook", async () => {
    const db = database();
    db.state.profiles.get("owner")!.billing_environment = "live_mode";
    expect((await deliver()).status).toBe(500);
  });
  it("stops late billing for a deleted account without recreating the profile", async () => {
    const db = database();
    db.state.deleted.add("owner");
    db.state.profiles.clear();
    expect((await deliver()).status).toBe(200);
    expect(mocks.terminate).toHaveBeenCalledWith(
      {
        customerId: "cus_owner",
        subscriptionId: "sub_owner",
        environment: "test_mode",
      },
      platform,
    );
    expect(db.state.profiles.size).toBe(0);
  });
  it("retries failed late-account billing termination", async () => {
    const db = database();
    db.state.deleted.add("owner");
    mocks.terminate.mockRejectedValueOnce(new Error("provider unavailable"));
    expect((await deliver()).status).toBe(500);
    expect((await deliver()).status).toBe(200);
    expect(mocks.terminate).toHaveBeenCalledTimes(2);
  });
  it("does not replace one open subscription with another", async () => {
    const db = database();
    db.state.profiles.get("owner")!.billing_subscription_id = "sub_existing";
    expect((await deliver()).status).toBe(500);
    expect(db.state.profiles.get("owner")?.billing_subscription_id).toBe(
      "sub_existing",
    );
  });
  it("permits a new subscription when the old provider subscription is terminal", async () => {
    const db = database();
    db.state.profiles.get("owner")!.billing_subscription_id = "sub_existing";
    mocks.retrieveSubscription.mockImplementation(async (id) =>
      canonical(id === "sub_existing" ? "cancelled" : "active", id),
    );
    expect((await deliver()).status).toBe(200);
    expect(db.state.profiles.get("owner")?.billing_subscription_id).toBe(
      "sub_owner",
    );
  });
  it("does not revoke a new subscription for a delayed old cancellation", async () => {
    const db = database();
    db.state.profiles.get("owner")!.billing_subscription_id = "sub_new";
    mocks.retrieveSubscription.mockResolvedValue(canonical("cancelled"));
    expect((await deliver()).status).toBe(200);
    expect(db.state.profiles.get("owner")?.billing_subscription_id).toBe(
      "sub_new",
    );
  });
  it("reconciles subscription payments without granting from checkout return", async () => {
    const db = database();
    mocks.retrieveSubscription.mockResolvedValue(canonical("cancelled"));
    expect(
      (await deliver(event("payment.succeeded", { payment_id: "pay_owner" })))
        .status,
    ).toBe(200);
    expect(db.state.profiles.get("owner")?.plan).toBe("free");
  });
  it("cancels billing and revokes access on a canonical full refund", async () => {
    const db = database();
    mocks.retrieveRefund.mockResolvedValue({
      business_id: "bus_owner",
      payment_id: "pay_owner",
      status: "succeeded",
      is_partial: false,
    });
    expect(
      (
        await deliver(
          event("refund.succeeded", {
            refund_id: "ref_owner",
            payment_id: "pay_owner",
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.updateSubscription).toHaveBeenCalledWith("sub_owner", {
      status: "cancelled",
      cancel_at_next_billing_date: false,
      cancel_reason: "cancelled_by_merchant",
    });
    expect(db.state.profiles.get("owner")?.plan).toBe("free");
  });
  it("preserves access for a partial refund", async () => {
    const db = database();
    db.state.profiles.get("owner")!.plan = "pro";
    mocks.retrieveRefund.mockResolvedValue({
      business_id: "bus_owner",
      payment_id: "pay_owner",
      status: "succeeded",
      is_partial: true,
    });
    expect(
      (
        await deliver(
          event("refund.succeeded", {
            refund_id: "ref_owner",
            payment_id: "pay_owner",
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.updateSubscription).not.toHaveBeenCalled();
    expect(db.state.profiles.get("owner")?.plan).toBe("pro");
  });
  it("stops an open dispute and cannot restore it with a later won delivery", async () => {
    const db = database();
    mocks.retrieveDispute.mockResolvedValue({
      business_id: "bus_owner",
      payment_id: "pay_owner",
      dispute_status: "dispute_opened",
    });
    expect(
      (
        await deliver(
          event("dispute.opened", {
            dispute_id: "dis_owner",
            payment_id: "pay_owner",
          }),
        )
      ).status,
    ).toBe(200);
    mocks.retrieveDispute.mockResolvedValue({
      business_id: "bus_owner",
      payment_id: "pay_owner",
      dispute_status: "dispute_won",
    });
    expect(
      (
        await deliver(
          event("dispute.won", {
            dispute_id: "dis_owner",
            payment_id: "pay_owner",
          }),
          "evt_won",
        )
      ).status,
    ).toBe(200);
    expect(db.state.profiles.get("owner")?.plan).toBe("free");
    expect(mocks.updateSubscription).toHaveBeenCalledTimes(1);
  });
  it("never cancels billing when a refund payment/customer belongs elsewhere", async () => {
    database();
    mocks.retrieveRefund.mockResolvedValue({
      business_id: "bus_owner",
      payment_id: "pay_owner",
      status: "succeeded",
      is_partial: false,
    });
    mocks.retrievePayment.mockResolvedValue({
      business_id: "bus_owner",
      customer: { customer_id: "cus_foreign" },
      subscription_ids: ["sub_owner"],
    });
    expect(
      (
        await deliver(
          event("refund.succeeded", {
            refund_id: "ref_owner",
            payment_id: "pay_owner",
          }),
        )
      ).status,
    ).toBe(500);
    expect(mocks.updateSubscription).not.toHaveBeenCalled();
  });
});
