import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  terminateStripeBillingForAccount: vi.fn(),
  deleteQueuedObjectsBestEffort: vi.fn(),
  enqueueObjectDeletions: vi.fn(),
  lockObjectOwner: vi.fn(),
  isStaffUser: vi.fn(),
}));

vi.mock("$server/domain/billing", () => ({
  terminateStripeBillingForAccount: mocks.terminateStripeBillingForAccount,
}));
vi.mock("$server/r2/files", () => ({
  deleteQueuedObjectsBestEffort: mocks.deleteQueuedObjectsBestEffort,
  enqueueObjectDeletions: mocks.enqueueObjectDeletions,
  lockObjectOwner: mocks.lockObjectOwner,
}));
vi.mock("$server/domain/staff", () => ({
  isStaffUser: mocks.isStaffUser,
}));

import { actions } from "../../src/routes/(app)/admin/+page.server";

function request() {
  const form = new FormData();
  form.set("id", "request-1");
  return new Request("https://moto-track.net/admin?/fulfillDataRequest", {
    method: "POST",
    body: form,
  });
}

function database() {
  const queries: Array<{
    sql: string;
    values: unknown[];
    transaction: boolean;
  }> = [];

  const query = async (
    strings: TemplateStringsArray,
    values: unknown[],
    transaction: boolean,
  ) => {
    const sql = strings.join("?").replaceAll(/\s+/g, " ").trim();
    queries.push({ sql, values, transaction });
    if (sql.startsWith("select request.owner_id")) {
      return [
        {
          owner_id: "owner-1",
          request_type: "deletion",
          status: "open",
          stripe_customer_id: "cus_owner",
          stripe_subscription_id: "sub_owner",
        },
      ];
    }
    if (sql.startsWith("select object_key")) return [];
    if (sql.startsWith('delete from neon_auth."user"')) {
      return [{ id: "owner-1" }];
    }
    return [];
  };

  const db = (async (strings: TemplateStringsArray, ...values: unknown[]) =>
    query(strings, values, false)) as unknown as App.Locals["db"];
  db.begin = (async (callback: (transaction: unknown) => unknown) => {
    const transaction = async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => query(strings, values, true);
    return callback(transaction);
  }) as typeof db.begin;
  return { db, queries };
}

describe("LGPD account deletion lifecycle", () => {
  beforeEach(() => {
    mocks.isStaffUser.mockReset().mockResolvedValue(true);
    mocks.terminateStripeBillingForAccount
      .mockReset()
      .mockResolvedValue(undefined);
    mocks.deleteQueuedObjectsBestEffort
      .mockReset()
      .mockResolvedValue(undefined);
    mocks.enqueueObjectDeletions.mockReset().mockResolvedValue([]);
    mocks.lockObjectOwner.mockReset().mockResolvedValue(undefined);
  });

  it("preserves local data and the open request when Stripe termination fails", async () => {
    const { db, queries } = database();
    mocks.terminateStripeBillingForAccount.mockRejectedValue(
      new Error("Stripe unavailable"),
    );

    const result = await actions.fulfillDataRequest({
      request: request(),
      locals: { db },
      platform: { env: {} },
    } as never);

    expect(result).toMatchObject({ status: 502 });
    expect(mocks.terminateStripeBillingForAccount).toHaveBeenCalledWith(
      { customerId: "cus_owner", subscriptionId: "sub_owner" },
      expect.anything(),
    );
    expect(queries.some((entry) => entry.sql.includes("set notes"))).toBe(true);
    expect(
      queries.some((entry) =>
        entry.sql.includes('delete from neon_auth."user"'),
      ),
    ).toBe(false);
    expect(mocks.deleteQueuedObjectsBestEffort).not.toHaveBeenCalled();
  });

  it("only starts the irreversible local cascade after Stripe succeeds", async () => {
    const { db, queries } = database();

    const result = await actions.fulfillDataRequest({
      request: request(),
      locals: { db },
      platform: { env: {} },
    } as never);

    expect(result).toEqual({ ok: true });
    expect(mocks.terminateStripeBillingForAccount).toHaveBeenCalledOnce();
    expect(mocks.lockObjectOwner).toHaveBeenCalledWith(
      expect.any(Function),
      "owner-1",
    );
    const deletion = queries.find((entry) =>
      entry.sql.includes('delete from neon_auth."user"'),
    );
    const benchmarkCleanup = queries.find((entry) =>
      entry.sql.includes("delete from anonymous_model_benchmark_contributions"),
    );
    const tombstone = queries.find((entry) =>
      entry.sql.includes("insert into account_deletion_tombstones"),
    );
    expect(tombstone).toMatchObject({
      transaction: true,
      values: ["owner-1", "cus_owner", "sub_owner"],
    });
    expect(deletion).toMatchObject({ transaction: true });
    expect(deletion?.sql).toContain("request.status = 'open'");
    expect(benchmarkCleanup).toMatchObject({
      transaction: true,
      values: ["owner-1"],
    });
    expect(benchmarkCleanup?.sql).toContain(
      "guard.contribution_id = contribution.id",
    );
    expect(queries.indexOf(benchmarkCleanup!)).toBeLessThan(
      queries.indexOf(deletion!),
    );
    expect(mocks.deleteQueuedObjectsBestEffort).toHaveBeenCalledWith({
      db,
      objectKeys: [],
      ownerId: "owner-1",
      platform: { env: {} },
    });
  });
});
