import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelSubscription = vi.fn();
const deleteCustomer = vi.fn();

vi.mock("stripe", () => ({
  default: class {
    subscriptions = { cancel: cancelSubscription };
    customers = { del: deleteCustomer };
  },
}));
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));

import { terminateStripeBillingForAccount } from "$server/domain/billing";

const platform = {
  env: { STRIPE_SECRET_KEY: "sk_test_account_deletion" },
} as unknown as App.Platform;

describe("Stripe account termination", () => {
  beforeEach(() => {
    cancelSubscription.mockReset().mockResolvedValue({ status: "canceled" });
    deleteCustomer.mockReset().mockResolvedValue({ deleted: true });
  });

  it("cancels the known subscription and deletes the customer", async () => {
    await terminateStripeBillingForAccount(
      { customerId: "cus_owner", subscriptionId: "sub_owner" },
      platform,
    );

    expect(cancelSubscription).toHaveBeenCalledWith("sub_owner");
    expect(deleteCustomer).toHaveBeenCalledWith("cus_owner");
    expect(cancelSubscription.mock.invocationCallOrder[0]).toBeLessThan(
      deleteCustomer.mock.invocationCallOrder[0],
    );
  });

  it("is safe to retry after Stripe resources were already removed", async () => {
    const missing = Object.assign(new Error("No such resource"), {
      code: "resource_missing",
    });
    cancelSubscription.mockRejectedValue(missing);
    deleteCustomer.mockRejectedValue(missing);

    await expect(
      terminateStripeBillingForAccount(
        { customerId: "cus_old", subscriptionId: "sub_old" },
        platform,
      ),
    ).resolves.toBeUndefined();
  });

  it("propagates provider failures before customer deletion", async () => {
    cancelSubscription.mockRejectedValue(new Error("Stripe unavailable"));

    await expect(
      terminateStripeBillingForAccount(
        { customerId: "cus_owner", subscriptionId: "sub_owner" },
        platform,
      ),
    ).rejects.toThrow("Stripe unavailable");
    expect(deleteCustomer).not.toHaveBeenCalled();
  });

  it("does not require Stripe configuration when the account has no billing references", async () => {
    await expect(
      terminateStripeBillingForAccount({}, {
        env: {},
      } as unknown as App.Platform),
    ).resolves.toBeUndefined();
    expect(cancelSubscription).not.toHaveBeenCalled();
    expect(deleteCustomer).not.toHaveBeenCalled();
  });
});
