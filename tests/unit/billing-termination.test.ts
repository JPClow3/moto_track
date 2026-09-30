import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  update: vi.fn(),
  list: vi.fn(),
  block: vi.fn(),
  verifyBlock: vi.fn(),
  retrieveCustomer: vi.fn(),
  listCustomers: vi.fn(),
}));
vi.mock("dodopayments", () => ({
  default: class {
    subscriptions = mocks;
    customers = { retrieve: mocks.retrieveCustomer, list: mocks.listCustomers };
    blocklist = {
      customers: { create: mocks.block, retrieve: mocks.verifyBlock },
    };
  },
}));
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));
import { terminateBillingForAccount } from "$server/domain/billing";
const platform = {
  env: {
    DODO_PAYMENTS_API_KEY: "test_key",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
    DODO_PRO_MONTHLY_PRODUCT_ID: "pdt_monthly",
  },
} as unknown as App.Platform;
function record(id: string, status = "active") {
  return {
    subscription_id: id,
    status,
    customer: { customer_id: "cus_owner" },
    product_id: "pdt_monthly",
    metadata: { app: "moto_track", user_id: "owner" },
  };
}
function list(items: ReturnType<typeof record>[]) {
  return (async function* () {
    for (const item of items) yield item;
  })();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.retrieve.mockImplementation(async (id) => record(id));
  mocks.update.mockResolvedValue(record("sub_owner", "cancelled"));
  mocks.list.mockImplementation(() => list([]));
  mocks.block.mockResolvedValue({
    id: "blk_owner",
    customer_id: "cus_owner",
    subscriptions_swept: true,
  });
  mocks.verifyBlock.mockResolvedValue({
    id: "blk_owner",
    customer_id: "cus_owner",
    unblocked_at: null,
  });
  mocks.retrieveCustomer.mockResolvedValue({
    customer_id: "cus_owner",
    email: "owner@example.com",
    metadata: { app: "moto_track", user_id: "owner", environment: "test_mode" },
  });
  mocks.listCustomers.mockImplementation(() =>
    (async function* () {
      yield* [];
    })(),
  );
});
describe("Dodo account billing termination", () => {
  it("enumerates and immediately cancels every subscription including older pages", async () => {
    mocks.list
      .mockImplementationOnce(() =>
        list([record("sub_extra"), record("sub_old", "cancelled")]),
      )
      .mockImplementationOnce(() =>
        list([record("sub_extra"), record("sub_old", "cancelled")]),
      )
      .mockImplementationOnce(() =>
        list([
          record("sub_owner", "cancelled"),
          record("sub_extra", "cancelled"),
        ]),
      );
    await terminateBillingForAccount(
      {
        customerId: "cus_owner",
        subscriptionId: "sub_owner",
        environment: "test_mode",
      },
      platform,
    );
    expect(mocks.update.mock.calls.map((call) => call[0])).toEqual([
      "sub_owner",
      "sub_extra",
    ]);
    expect(mocks.update).toHaveBeenCalledWith("sub_extra", {
      status: "cancelled",
      cancel_at_next_billing_date: false,
      cancel_reason: "cancelled_by_merchant",
    });
    expect(mocks.list).toHaveBeenCalledTimes(3);
    expect(mocks.block).toHaveBeenCalledWith({
      customer_id: "cus_owner",
      reason: "Moto Track account deletion",
    });
    expect(mocks.block.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.update.mock.invocationCallOrder[0],
    );
  });
  it("is safe to retry a missing known subscription", async () => {
    mocks.retrieve.mockRejectedValue(
      Object.assign(new Error("missing"), { status: 404 }),
    );
    await expect(
      terminateBillingForAccount(
        { subscriptionId: "sub_missing", environment: "test_mode" },
        platform,
      ),
    ).resolves.toBeUndefined();
  });
  it("does not call update for already cancelled subscriptions", async () => {
    mocks.retrieve.mockResolvedValue(record("sub_owner", "cancelled"));
    await terminateBillingForAccount(
      { subscriptionId: "sub_owner", environment: "test_mode" },
      platform,
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("fails closed when subscription enumeration fails", async () => {
    mocks.list.mockImplementation(() =>
      (async function* () {
        yield Promise.reject(new Error("provider unavailable"));
      })(),
    );
    await expect(
      terminateBillingForAccount(
        { customerId: "cus_owner", environment: "test_mode" },
        platform,
      ),
    ).rejects.toThrow("provider unavailable");
  });
  it("fails closed when immediate cancellation fails", async () => {
    mocks.update.mockRejectedValue(new Error("provider unavailable"));
    await expect(
      terminateBillingForAccount(
        { subscriptionId: "sub_owner", environment: "test_mode" },
        platform,
      ),
    ).rejects.toThrow("provider unavailable");
  });
  it("rejects cancellation that only schedules or leaves billing active", async () => {
    mocks.update.mockResolvedValue(record("sub_owner"));
    await expect(
      terminateBillingForAccount(
        { subscriptionId: "sub_owner", environment: "test_mode" },
        platform,
      ),
    ).rejects.toThrow("did not cancel");
  });
  it("verifies no additional subscription remains open after cancellation", async () => {
    mocks.list
      .mockImplementationOnce(() => list([]))
      .mockImplementationOnce(() => list([]))
      .mockImplementationOnce(() => list([record("sub_race")]));
    await expect(
      terminateBillingForAccount(
        { customerId: "cus_owner", environment: "test_mode" },
        platform,
      ),
    ).rejects.toThrow("still has an open");
  });
  it("rejects mismatched customer ownership", async () => {
    mocks.retrieve.mockResolvedValue({
      ...record("sub_other"),
      customer: { customer_id: "cus_other" },
    });
    await expect(
      terminateBillingForAccount(
        {
          customerId: "cus_owner",
          subscriptionId: "sub_other",
          environment: "test_mode",
        },
        platform,
      ),
    ).rejects.toThrow("customer mismatch");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["live_mode", null])(
    "rejects incompatible or missing environment %s",
    async (environment) => {
      await expect(
        terminateBillingForAccount(
          { subscriptionId: "sub_owner", environment },
          platform,
        ),
      ).rejects.toThrow("environment mismatch");
      expect(mocks.retrieve).not.toHaveBeenCalled();
    },
  );
  it("needs no provider configuration for an account with no references", async () => {
    await expect(
      terminateBillingForAccount({}, { env: {} } as App.Platform),
    ).resolves.toBeUndefined();
  });
  it("fails closed when the provider cannot block outstanding checkout links", async () => {
    mocks.block.mockRejectedValue(new Error("blocking failed"));
    await expect(
      terminateBillingForAccount(
        { customerId: "cus_owner", environment: "test_mode" },
        platform,
      ),
    ).rejects.toThrow("blocking failed");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("retries an incomplete block sweep before confirming termination", async () => {
    mocks.block.mockResolvedValueOnce({
      id: "blk_owner",
      customer_id: "cus_owner",
      subscriptions_swept: false,
    });
    await terminateBillingForAccount(
      { customerId: "cus_owner", environment: "test_mode" },
      platform,
    );
    expect(mocks.block).toHaveBeenCalledTimes(2);
  });
  it("rejects an incomplete block sweep or inactive block after cancellation", async () => {
    mocks.block.mockResolvedValue({
      id: "blk_owner",
      customer_id: "cus_owner",
      subscriptions_swept: false,
    });
    await expect(
      terminateBillingForAccount(
        { customerId: "cus_owner", environment: "test_mode" },
        platform,
      ),
    ).rejects.toThrow("sweep is incomplete");
    mocks.block.mockResolvedValue({
      id: "blk_owner",
      customer_id: "cus_owner",
      subscriptions_swept: true,
    });
    mocks.verifyBlock.mockResolvedValue({
      customer_id: "cus_owner",
      unblocked_at: "2026-09-29T12:00:00Z",
    });
    await expect(
      terminateBillingForAccount(
        { customerId: "cus_owner", environment: "test_mode" },
        platform,
      ),
    ).rejects.toThrow("not active");
  });
  it("refuses the business-wide block when another app/customer shares the email", async () => {
    mocks.listCustomers.mockImplementation(() =>
      (async function* () {
        yield {
          customer_id: "cus_other_app",
          email: "OWNER+alias@example.com",
          metadata: { app: "lorebound", user_id: "owner" },
        };
      })(),
    );
    await expect(
      terminateBillingForAccount(
        { customerId: "cus_owner", environment: "test_mode" },
        platform,
      ),
    ).rejects.toThrow("shared with another billing");
    expect(mocks.block).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("refuses to block/cancel non-Moto subscriptions even on its own customer", async () => {
    mocks.list.mockImplementation(() =>
      list([{ ...record("sub_other_app"), product_id: "pdt_lorebound" }]),
    );
    await expect(
      terminateBillingForAccount(
        { customerId: "cus_owner", environment: "test_mode" },
        platform,
      ),
    ).rejects.toThrow("outside Moto Track");
    expect(mocks.block).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
