import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  terminateBillingForAccount: vi.fn(),
  deleteQueuedObjectsBestEffort: vi.fn(),
  enqueueObjectDeletions: vi.fn(),
  lockObjectOwner: vi.fn(),
  isStaffUser: vi.fn(),
}));

vi.mock("$server/domain/billing", () => ({
  terminateBillingForAccount: mocks.terminateBillingForAccount,
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

function database(
  provider: "dodo" | "legacy" = "dodo",
  freshOverrides: Record<string, unknown> = {},
  failLocalDeletion = false,
) {
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
          billing_provider: provider,
          billing_environment: "test_mode",
          billing_customer_id: "cus_owner",
          billing_subscription_id: "sub_owner",
          ...(transaction ? freshOverrides : {}),
        },
      ];
    }
    if (sql.startsWith("select object_key")) return [];
    if (sql.startsWith('delete from neon_auth."user"')) {
      if (failLocalDeletion) throw new Error("Local deletion unavailable");
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
    mocks.terminateBillingForAccount.mockReset().mockResolvedValue(undefined);
    mocks.deleteQueuedObjectsBestEffort
      .mockReset()
      .mockResolvedValue(undefined);
    mocks.enqueueObjectDeletions.mockReset().mockResolvedValue([]);
    mocks.lockObjectOwner.mockReset().mockResolvedValue(undefined);
  });

  it("preserves local data and the open request when Dodo Payments termination fails", async () => {
    const { db, queries } = database();
    mocks.terminateBillingForAccount.mockRejectedValue(
      new Error("Dodo Payments unavailable"),
    );

    const result = await actions.fulfillDataRequest({
      request: request(),
      locals: { db },
      platform: { env: {} },
    } as never);

    expect(result).toMatchObject({ status: 502 });
    expect(mocks.terminateBillingForAccount).toHaveBeenCalledWith(
      {
        customerId: "cus_owner",
        subscriptionId: "sub_owner",
        environment: "test_mode",
      },
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

  it("only starts the irreversible local cascade after Dodo Payments succeeds", async () => {
    const { db, queries } = database();

    const result = await actions.fulfillDataRequest({
      request: request(),
      locals: { db },
      platform: { env: {} },
    } as never);

    expect(result).toEqual({ ok: true });
    expect(mocks.terminateBillingForAccount).toHaveBeenCalledOnce();
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
      values: ["owner-1", "dodo", "test_mode", "cus_owner", "sub_owner"],
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

  it("cancels only the fresh customer after acquiring the shared billing lock", async () => {
    const { db, queries } = database("dodo", {
      billing_customer_id: "cus_committed_checkout",
      billing_subscription_id: "sub_committed_checkout",
    });
    mocks.terminateBillingForAccount.mockImplementation(async () => {
      const lock = queries.findIndex((entry) =>
        entry.sql.includes("pg_advisory_xact_lock(hashtextextended"),
      );
      const fresh = queries.findIndex(
        (entry) =>
          entry.sql.includes("for update of request") && entry.transaction,
      );
      expect(lock).toBeGreaterThan(-1);
      expect(fresh).toBeGreaterThan(lock);
      expect(queries[lock]).toMatchObject({ transaction: true });
      expect(queries.some((entry) => entry.sql.startsWith("delete from"))).toBe(
        false,
      );
    });
    expect(
      await actions.fulfillDataRequest({
        request: request(),
        locals: { db },
        platform: { env: {} },
      } as never),
    ).toEqual({ ok: true });
    expect(mocks.terminateBillingForAccount).toHaveBeenCalledWith(
      {
        customerId: "cus_committed_checkout",
        subscriptionId: "sub_committed_checkout",
        environment: "test_mode",
      },
      expect.anything(),
    );
    expect(
      queries.find((entry) =>
        entry.sql.includes("insert into account_deletion_tombstones"),
      )?.values,
    ).toEqual([
      "owner-1",
      "dodo",
      "test_mode",
      "cus_committed_checkout",
      "sub_committed_checkout",
    ]);
  });

  it("does not contact Dodo if the deletion request changes while waiting for the lock", async () => {
    const { db, queries } = database("dodo", { status: "fulfilled" });
    expect(
      await actions.fulfillDataRequest({
        request: request(),
        locals: { db },
        platform: { env: {} },
      } as never),
    ).toMatchObject({ status: 400 });
    expect(mocks.terminateBillingForAccount).not.toHaveBeenCalled();
    expect(queries.some((entry) => entry.sql.startsWith("delete from"))).toBe(
      false,
    );
  });

  it("leaves an open request with retry notes when cancellation succeeds but the local cascade fails", async () => {
    const { db, queries } = database("dodo", {}, true);
    expect(
      await actions.fulfillDataRequest({
        request: request(),
        locals: { db },
        platform: { env: {} },
      } as never),
    ).toMatchObject({ status: 400 });
    expect(mocks.terminateBillingForAccount).toHaveBeenCalledOnce();
    expect(
      queries.some(
        (entry) => entry.sql.includes("set notes") && !entry.transaction,
      ),
    ).toBe(true);
    expect(mocks.deleteQueuedObjectsBestEffort).not.toHaveBeenCalled();
  });

  it("preserves unresolved former-provider IDs without sending them to Dodo", async () => {
    const { db, queries } = database("legacy");
    const result = await actions.fulfillDataRequest({
      request: request(),
      locals: { db },
      platform: { env: {} },
    } as never);

    expect(result).toMatchObject({ status: 502 });
    expect(mocks.terminateBillingForAccount).not.toHaveBeenCalled();
    expect(
      queries.some((entry) =>
        entry.sql.includes('delete from neon_auth."user"'),
      ),
    ).toBe(false);
  });
});
