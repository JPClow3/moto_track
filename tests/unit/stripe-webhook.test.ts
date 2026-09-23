import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  constructStripeEvent: vi.fn(),
  getDb: vi.fn(),
  graceUntilFrom: vi.fn(() => "2026-09-25T12:00:00.000Z"),
  terminateStripeBillingForAccount: vi.fn(),
  subscriptionProfileUpdate: vi.fn(() => ({
    stripe_subscription_status: "active",
    plan: "pro",
    grace_until: null,
    stripe_customer_id: "cus_subscription",
    stripe_subscription_id: "sub_target",
    billing_interval: "month",
    cancel_at_period_end: false,
    current_period_end: "2026-10-22T12:00:00.000Z",
  })),
}));

vi.mock("$server/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("$server/domain/billing", () => ({
  constructStripeEvent: mocks.constructStripeEvent,
  graceUntilFrom: mocks.graceUntilFrom,
  terminateStripeBillingForAccount: mocks.terminateStripeBillingForAccount,
  subscriptionProfileUpdate: mocks.subscriptionProfileUpdate,
}));

import { POST } from "../../src/routes/billing/webhook/stripe/+server";

type StoredEvent = {
  processedAt: string | null;
  processingError: string;
};
type Profile = Record<string, unknown> & {
  owner_id: string;
  stripe_subscription_id?: string;
  stripe_subscription_status?: string;
};
type Query = { sql: string; values: unknown[]; transaction: boolean };

function sqlText(strings: TemplateStringsArray): string {
  return strings.join("?").replace(/\s+/g, " ").trim().toLowerCase();
}

function createMockDatabase() {
  const state = {
    events: new Map<string, StoredEvent>(),
    profiles: new Map<string, Profile>(),
    deletedOwners: new Set<string>(),
  };
  const queries: Query[] = [];
  let failNextProfileWrite = false;

  function queryFunction(transactionState: typeof state, transaction: boolean) {
    const query = vi.fn((first: unknown, ...values: unknown[]) => {
      // postgres.js also uses the callable SQL object as an insert helper.
      if (!Array.isArray(first)) return { __insert: first };

      const sql = sqlText(first as unknown as TemplateStringsArray);
      queries.push({ sql, values, transaction });

      if (sql.startsWith("insert into billing_events")) {
        const eventId = String(values[0]);
        if (!transactionState.events.has(eventId)) {
          transactionState.events.set(eventId, {
            processedAt: null,
            processingError: "",
          });
        }
        return Promise.resolve([]);
      }

      if (sql.startsWith("select processed_at from billing_events")) {
        const stored = transactionState.events.get(String(values[0]));
        return Promise.resolve(
          stored ? [{ processed_at: stored.processedAt }] : [],
        );
      }

      if (sql.startsWith("select owner_id from subscription_profiles")) {
        const subscriptionId = String(values[0]);
        const profile = [...transactionState.profiles.values()].find(
          (candidate) => candidate.stripe_subscription_id === subscriptionId,
        );
        return Promise.resolve(profile ? [{ owner_id: profile.owner_id }] : []);
      }

      if (
        sql.startsWith("select exists") &&
        sql.includes("account_deletion_tombstones")
      ) {
        return Promise.resolve([
          { deleted: transactionState.deletedOwners.has(String(values[0])) },
        ]);
      }

      if (sql.startsWith("insert into subscription_profiles")) {
        if (failNextProfileWrite) {
          failNextProfileWrite = false;
          return Promise.reject(new Error("profile write unavailable"));
        }
        const helper = values[0] as { __insert: Profile };
        const row = helper.__insert;
        transactionState.profiles.set(row.owner_id, {
          ...transactionState.profiles.get(row.owner_id),
          ...row,
        });
        return Promise.resolve([]);
      }

      if (
        sql.startsWith("update subscription_profiles") &&
        sql.includes("stripe_subscription_status = 'past_due'")
      ) {
        if (failNextProfileWrite) {
          failNextProfileWrite = false;
          return Promise.reject(new Error("profile write unavailable"));
        }
        const subscriptionId = String(values[1]);
        for (const [ownerId, profile] of transactionState.profiles) {
          if (
            profile.stripe_subscription_id === subscriptionId &&
            ["active", "trialing", "past_due"].includes(
              String(profile.stripe_subscription_status),
            )
          ) {
            transactionState.profiles.set(ownerId, {
              ...profile,
              plan: "pro",
              stripe_subscription_status: "past_due",
              grace_until: values[0],
            });
          }
        }
        return Promise.resolve([]);
      }

      if (
        sql.startsWith("update billing_events") &&
        sql.includes("set processed_at")
      ) {
        const stored = transactionState.events.get(String(values[1]));
        if (stored) {
          stored.processedAt = String(values[0]);
          stored.processingError = "";
        }
        return Promise.resolve([]);
      }

      if (
        sql.startsWith("update billing_events") &&
        sql.includes("set processing_error")
      ) {
        const stored = transactionState.events.get(String(values[1]));
        if (stored && !stored.processedAt) {
          stored.processingError = String(values[0]);
        }
        return Promise.resolve([]);
      }

      return Promise.reject(new Error(`Unexpected SQL: ${sql}`));
    });

    return query;
  }

  const db = queryFunction(state, false) as ReturnType<typeof queryFunction> & {
    json: (value: unknown) => unknown;
    begin: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  };
  db.json = (value) => value;
  db.begin = async (callback) => {
    const transactionState = {
      events: new Map(
        [...state.events].map(([id, event]) => [id, { ...event }]),
      ),
      profiles: new Map(
        [...state.profiles].map(([id, profile]) => [id, { ...profile }]),
      ),
      deletedOwners: new Set(state.deletedOwners),
    };
    const tx = queryFunction(transactionState, true);
    const result = await callback(tx);
    state.events = transactionState.events;
    state.profiles = transactionState.profiles;
    state.deletedOwners = transactionState.deletedOwners;
    return result;
  };

  return {
    db,
    state,
    queries,
    failNextProfileWrite() {
      failNextProfileWrite = true;
    },
  };
}

function stripeEvent(
  type: Stripe.Event.Type,
  object: Record<string, unknown>,
  id = "evt_123",
): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

async function deliver(event: Stripe.Event, signature = "valid-signature") {
  mocks.constructStripeEvent.mockReturnValue(event);
  return POST({
    request: new Request("http://localhost/billing/webhook/stripe", {
      method: "POST",
      body: JSON.stringify(event),
      headers: { "stripe-signature": signature },
    }),
    platform: { env: {} },
  } as unknown as Parameters<typeof POST>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Stripe webhook", () => {
  it("rejects an invalid signature before opening a database connection", async () => {
    mocks.constructStripeEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST({
      request: new Request("http://localhost/billing/webhook/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "invalid" },
      }),
    } as unknown as Parameters<typeof POST>[0]);

    expect(response.status).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("persists pending first, then commits the effect and processed marker together", async () => {
    const database = createMockDatabase();
    mocks.getDb.mockReturnValue(database.db);
    const event = stripeEvent("checkout.session.completed", {
      metadata: { user_id: "owner-a" },
      customer: "cus_a",
      subscription: "sub_a",
    });

    const response = await deliver(event);

    expect(response.status).toBe(200);
    expect(database.state.events.get(event.id)?.processedAt).not.toBeNull();
    expect(database.state.profiles.get("owner-a")).toMatchObject({
      stripe_customer_id: "cus_a",
      stripe_subscription_id: "sub_a",
    });
    expect(database.queries[0]).toMatchObject({ transaction: false });
    expect(database.queries[0].sql).toContain("processed_at");
    expect(database.queries[0].sql).not.toContain("payload");
    const effect = database.queries.find((query) =>
      query.sql.startsWith("insert into subscription_profiles"),
    );
    const marker = database.queries.find((query) =>
      query.sql.includes("set processed_at"),
    );
    expect(effect?.transaction).toBe(true);
    expect(marker?.transaction).toBe(true);
  });

  it("acknowledges a late checkout webhook without recreating a deleted account", async () => {
    const database = createMockDatabase();
    database.state.deletedOwners.add("owner-deleted");
    mocks.getDb.mockReturnValue(database.db);
    const event = stripeEvent("checkout.session.completed", {
      metadata: { user_id: "owner-deleted" },
      customer: { id: "cus_deleted" },
      subscription: { id: "sub_deleted" },
    });

    const response = await deliver(event);

    expect(response.status).toBe(200);
    expect(database.state.profiles.has("owner-deleted")).toBe(false);
    expect(mocks.terminateStripeBillingForAccount).toHaveBeenNthCalledWith(
      1,
      { customerId: "cus_deleted", subscriptionId: "sub_deleted" },
      { env: {} },
    );
    expect(database.state.events.get(event.id)?.processedAt).not.toBeNull();
    expect(mocks.terminateStripeBillingForAccount).toHaveBeenCalledWith(
      { customerId: "cus_deleted", subscriptionId: "sub_deleted" },
      { env: {} },
    );
  });

  it("leaves a tombstoned checkout pending and retries Stripe termination after provider failure", async () => {
    const database = createMockDatabase();
    database.state.deletedOwners.add("owner-deleted");
    mocks.getDb.mockReturnValue(database.db);
    mocks.terminateStripeBillingForAccount
      .mockRejectedValueOnce(new Error("Stripe unavailable"))
      .mockResolvedValueOnce(undefined);
    const event = stripeEvent("checkout.session.completed", {
      metadata: { user_id: "owner-deleted" },
      customer: "cus_deleted",
      subscription: "sub_deleted",
    });

    const failed = await deliver(event);
    expect(failed.status).toBe(500);
    expect(database.state.events.get(event.id)).toEqual({
      processedAt: null,
      processingError: "Stripe unavailable",
    });
    expect(database.state.profiles.has("owner-deleted")).toBe(false);
    expect(mocks.terminateStripeBillingForAccount).toHaveBeenNthCalledWith(
      1,
      { customerId: "cus_deleted", subscriptionId: "sub_deleted" },
      { env: {} },
    );

    const retried = await deliver(event);
    expect(retried.status).toBe(200);
    expect(database.state.events.get(event.id)?.processedAt).not.toBeNull();
    expect(database.state.profiles.has("owner-deleted")).toBe(false);
    expect(mocks.terminateStripeBillingForAccount).toHaveBeenNthCalledWith(
      2,
      { customerId: "cus_deleted", subscriptionId: "sub_deleted" },
      { env: {} },
    );
  });

  it("acknowledges an already processed duplicate without replaying effects", async () => {
    const database = createMockDatabase();
    database.state.events.set("evt_done", {
      processedAt: "2026-09-22T12:00:00.000Z",
      processingError: "",
    });
    mocks.getDb.mockReturnValue(database.db);
    const event = stripeEvent(
      "checkout.session.completed",
      {
        metadata: { user_id: "owner-a" },
        customer: "cus_a",
        subscription: "sub_a",
      },
      "evt_done",
    );

    const response = await deliver(event);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(database.state.profiles.size).toBe(0);
    expect(
      database.queries.some((query) => query.sql.includes("set processed_at")),
    ).toBe(false);
  });

  it("returns 500 on an effect failure, records the error, and retries the pending event", async () => {
    const database = createMockDatabase();
    database.failNextProfileWrite();
    mocks.getDb.mockReturnValue(database.db);
    const event = stripeEvent("checkout.session.completed", {
      metadata: { user_id: "owner-retry" },
      customer: "cus_retry",
      subscription: "sub_retry",
    });

    const failed = await deliver(event);
    expect(failed.status).toBe(500);
    expect(database.state.events.get(event.id)).toEqual({
      processedAt: null,
      processingError: "profile write unavailable",
    });
    expect(database.state.profiles.has("owner-retry")).toBe(false);

    const retried = await deliver(event);
    expect(retried.status).toBe(200);
    expect(database.state.events.get(event.id)?.processedAt).not.toBeNull();
    expect(database.state.events.get(event.id)?.processingError).toBe("");
    expect(database.state.profiles.get("owner-retry")).toMatchObject({
      stripe_subscription_id: "sub_retry",
    });
  });

  it("resolves subscription ownership only by the event subscription id", async () => {
    const database = createMockDatabase();
    database.state.profiles.set("owner-a", {
      owner_id: "owner-a",
      stripe_subscription_id: "sub_target",
      stripe_subscription_status: "active",
    });
    database.state.profiles.set("owner-b", {
      owner_id: "owner-b",
      stripe_subscription_id: "sub_other",
      stripe_subscription_status: "active",
    });
    mocks.getDb.mockReturnValue(database.db);
    const event = stripeEvent("customer.subscription.updated", {
      id: "sub_target",
      metadata: {},
    });

    const response = await deliver(event);

    expect(response.status).toBe(200);
    expect(database.state.profiles.get("owner-a")?.plan).toBe("pro");
    expect(database.state.profiles.get("owner-b")?.plan).toBeUndefined();
    const ownerLookup = database.queries.find((query) =>
      query.sql.startsWith("select owner_id from subscription_profiles"),
    );
    expect(ownerLookup?.values).toEqual(["sub_target"]);
  });

  it("marks only the failed invoice subscription as past due", async () => {
    const database = createMockDatabase();
    database.state.profiles.set("owner-a", {
      owner_id: "owner-a",
      stripe_subscription_id: "sub_target",
      stripe_subscription_status: "active",
    });
    database.state.profiles.set("owner-b", {
      owner_id: "owner-b",
      stripe_subscription_id: "sub_other",
      stripe_subscription_status: "active",
    });
    mocks.getDb.mockReturnValue(database.db);
    const event = stripeEvent("invoice.payment_failed", {
      parent: { subscription_details: { subscription: "sub_target" } },
    });

    const response = await deliver(event);

    expect(response.status).toBe(200);
    expect(
      database.state.profiles.get("owner-a")?.stripe_subscription_status,
    ).toBe("past_due");
    expect(
      database.state.profiles.get("owner-b")?.stripe_subscription_status,
    ).toBe("active");
    const update = database.queries.find((query) =>
      query.sql.startsWith("update subscription_profiles"),
    );
    expect(update?.values[1]).toBe("sub_target");
    expect(update?.transaction).toBe(true);
  });
});
