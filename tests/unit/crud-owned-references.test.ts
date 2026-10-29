import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertOwnedMotorcycleReference,
  featureActions,
} from "$server/domain/crud";
import { syncMotorcycleOdometer } from "$server/domain/odometer";
import { syncInsuranceReminder } from "$server/domain/record-sync";
import { POST, PATCH } from "../../src/routes/api/v1/[resource]/+server";
import { actions as expenses } from "../../src/routes/(app)/expenses/+page.server";

vi.mock("$server/domain/api-auth", () => ({
  requireApiUser: vi.fn().mockResolvedValue({ user: { id: "owner" } }),
}));
vi.mock("$server/domain/entitlement-guards", () => ({
  assertCanCreateReminder: vi.fn().mockResolvedValue(null),
  assertCanCreateUpload: vi.fn().mockResolvedValue(null),
  assertCanCreateWorkSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("$server/domain/odometer", () => ({
  syncMotorcycleOdometer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("$server/domain/record-sync", () => ({
  syncLinkedReminder: vi.fn(),
  syncInsuranceReminder: vi.fn().mockResolvedValue({ ok: true }),
  clearInsuranceReminder: vi.fn(),
}));

const fields: Record<string, Record<string, string>> = {
  fuel: { date: "2026-10-23", odometer_km: "1000", liters: "5" },
  maintenance: {
    date: "2026-10-23",
    odometer_km: "1000",
    maintenance_type: "oil",
  },
  tires: {
    installed_at: "2026-10-23",
    position: "front",
    brand_model: "original",
    installed_odometer_km: "1000",
  },
  documents: { name: "original", document_type: "registration" },
  reminders: { title: "original", trigger_type: "by_date" },
  expenses: { fee_type: "IPVA", year: "2026", due_date: "2026-10-23" },
  trabalho: {
    work_date: "2026-10-23",
    platform_source: "other",
    payment_method: "cash",
    odometer_start_km: "900",
    odometer_end_km: "1000",
  },
};

function database() {
  const bikes = [
    { id: "owned", owner: "owner", deleted: false, active: true },
    { id: "archived", owner: "owner", deleted: false, active: false },
    { id: "foreign", owner: "someone-else", deleted: false, active: true },
    { id: "deleted", owner: "owner", deleted: true, active: false },
  ];
  let inTransaction = false;
  const writes: Array<Record<string, unknown>> = [];
  const guardCalls: Array<{
    transactional: boolean;
    bike: unknown;
    owner: unknown;
  }> = [];
  const queryDb = (query: unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(query)) return { fragment: query };
    const sql = query.join(" ");
    if (
      sql.includes('from neon_auth."user"') &&
      sql.includes("for no key update")
    ) {
      if (!inTransaction) throw new Error("Owner lock must be transactional");
      return Promise.resolve(values[0] === "owner" ? [{ id: "owner" }] : []);
    }
    if (sql.includes("select id from motorcycles")) {
      guardCalls.push({
        transactional: inTransaction,
        bike: values[0],
        owner: values[1],
      });
      return Promise.resolve(
        bikes.filter(
          (bike) =>
            bike.id === values[0] &&
            bike.owner === values[1] &&
            !bike.deleted &&
            (!sql.includes("is_active = true") || bike.active),
        ),
      );
    }
    if (sql.includes("select id from insurance_policies"))
      return Promise.resolve(
        values[0] === "own-policy" && values[1] === "owner"
          ? [{ id: "own-policy" }]
          : [],
      );
    if (sql.includes("select * from"))
      return Promise.resolve([
        {
          id: "record",
          owner_id: "owner",
          motorcycle_id: "archived",
          completion_version: 4,
        },
      ]);
    if (
      sql.includes("insert into") ||
      (sql.includes("update ") && sql.includes("returning"))
    ) {
      const fragment = values.find(
        (value) =>
          value &&
          typeof value === "object" &&
          "fragment" in value &&
          typeof value.fragment === "object",
      ) as { fragment: Record<string, unknown> } | undefined;
      const record = { id: "record", ...fragment?.fragment };
      if (
        sql.includes("insert into insurance_policies") &&
        record.id === "foreign-policy"
      )
        return Promise.resolve([]);
      writes.push(record);
      return Promise.resolve([record]);
    }
    return Promise.resolve([]);
  };
  const db = Object.assign(queryDb, {
    begin: async (callback: (tx: unknown) => Promise<unknown>) => {
      const count = writes.length;
      inTransaction = true;
      try {
        return await callback(queryDb);
      } catch (cause) {
        writes.length = count;
        throw cause;
      } finally {
        inTransaction = false;
      }
    },
  });
  return { db, writes, guardCalls, inTransaction: () => inTransaction };
}

function event(db: unknown, body: Record<string, unknown>, resource?: string) {
  return {
    locals: { db, user: { id: "owner" }, locale: "pt-BR" },
    params: { resource },
    request: new Request("https://app.test/api/v1/records", {
      method: "POST",
      ...(resource
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }
        : { body: new URLSearchParams(body as Record<string, string>) }),
    }),
  };
}

describe("owner-scoped record references", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(syncMotorcycleOdometer).mockReset().mockResolvedValue(undefined);
  });

  for (const slug of Object.keys(fields)) {
    it.each(["foreign", "missing", "deleted"])(
      `${slug} refuses a %s motorcycle before writing`,
      async (motorcycle) => {
        const { db, writes, guardCalls } = database();
        const result = await featureActions(slug).default!(
          event(db, {
            ...fields[slug],
            motorcycle_id: motorcycle,
            _intent: "create",
          }) as never,
        );
        expect(result).toMatchObject({ status: 400 });
        expect(writes).toEqual([]);
        expect(guardCalls).toEqual([
          { transactional: true, bike: motorcycle, owner: "owner" },
        ]);
        expect(syncMotorcycleOdometer).not.toHaveBeenCalled();
      },
    );

    it(`${slug} accepts an owned archived motorcycle without imposing a new active-only rule`, async () => {
      const { db, writes, guardCalls } = database();
      const result = await featureActions(slug).default!(
        event(db, {
          ...fields[slug],
          motorcycle_id: "archived",
          _intent: "create",
        }) as never,
      );
      expect(result).toMatchObject({ ok: true });
      expect(writes).toHaveLength(1);
      expect(guardCalls).toEqual([
        { transactional: true, bike: "archived", owner: "owner" },
      ]);
    });
  }

  it("preserves an optional null reference without looking up an unrelated motorcycle", async () => {
    const { db, guardCalls } = database();
    await assertOwnedMotorcycleReference(db as never, "owner", null);
    expect(guardCalls).toEqual([]);
    await expect(
      assertOwnedMotorcycleReference(db as never, "owner", null, {
        required: true,
      }),
    ).rejects.toThrow("Moto não encontrada.");
  });

  it.each([POST, PATCH])(
    "rejects API owner injection in the transaction before writing",
    async (handler) => {
      const { db, writes, guardCalls } = database();
      await expect(
        handler(
          event(
            db,
            { ...fields.maintenance, id: "record", motorcycle_id: "foreign" },
            "maintenance-records",
          ) as never,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(writes).toEqual([]);
      expect(guardCalls).toEqual([
        { transactional: true, bike: "foreign", owner: "owner" },
      ]);
    },
  );

  it.each([POST, PATCH])(
    "does not silently discard an API client's claimed maintenance phase",
    async (handler) => {
      const { db, writes, guardCalls } = database();
      await expect(
        handler(
          event(
            db,
            {
              ...fields.maintenance,
              id: "record",
              motorcycle_id: "owned",
              completed_milestone: 3,
            },
            "maintenance-records",
          ) as never,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(writes).toEqual([]);
      expect(guardCalls).toEqual([]);
    },
  );

  it("recomputes both motorcycles in an allowed API move before the transaction ends", async () => {
    const fixture = database();
    const boundaries: boolean[] = [];
    vi.mocked(syncMotorcycleOdometer).mockImplementation(async () => {
      boundaries.push(fixture.inTransaction());
    });
    const response = await PATCH(
      event(
        fixture.db,
        { ...fields.maintenance, id: "record", motorcycle_id: "owned" },
        "maintenance-records",
      ) as never,
    );
    expect(response.status).toBe(200);
    expect(boundaries).toEqual([true, true]);
    expect(
      vi.mocked(syncMotorcycleOdometer).mock.calls.map((call) => call[2]),
    ).toEqual(["archived", "owned"]);
  });

  it("rolls back an API move when the transactional odometer update fails", async () => {
    const fixture = database();
    vi.mocked(syncMotorcycleOdometer).mockRejectedValueOnce(
      new Error("history unavailable"),
    );
    await expect(
      PATCH(
        event(
          fixture.db,
          { ...fields.maintenance, id: "record", motorcycle_id: "owned" },
          "maintenance-records",
        ) as never,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(fixture.writes).toEqual([]);
  });

  it("invalidates old reminder completion forms on API edits using the server version", async () => {
    const fixture = database();
    const response = await PATCH(
      event(
        fixture.db,
        {
          ...fields.reminders,
          id: "record",
          motorcycle_id: "owned",
          completion_version: 9999,
        },
        "reminders",
      ) as never,
    );
    expect(response.status).toBe(200);
    expect(fixture.writes[0].completion_version).toBe(5);
  });

  it.each(["foreign", "missing", "deleted"])(
    "rejects insurance linked to a %s motorcycle",
    async (motorcycle) => {
      const { db, writes } = database();
      expect(
        await expenses.savePolicy(
          event(db, {
            motorcycle_id: motorcycle,
            provider: "original",
            coverage_start: "2026-01-01",
            coverage_end: "2027-01-01",
          }) as never,
        ),
      ).toMatchObject({ status: 400 });
      expect(writes).toEqual([]);
    },
  );

  it("saves insurance for the owner's archived motorcycle", async () => {
    const { db, writes } = database();
    expect(
      await expenses.savePolicy(
        event(db, {
          motorcycle_id: "archived",
          provider: "original",
          coverage_start: "2026-01-01",
          coverage_end: "2027-01-01",
        }) as never,
      ),
    ).toMatchObject({ ok: true });
    expect(writes).toHaveLength(1);
  });

  it("does not create a reminder after an insurance id conflicts with another owner", async () => {
    const { db, writes } = database();
    expect(
      await expenses.savePolicy(
        event(db, {
          id: "foreign-policy",
          motorcycle_id: "owned",
          provider: "original",
          coverage_start: "2026-01-01",
          coverage_end: "2027-01-01",
        }) as never,
      ),
    ).toMatchObject({ status: 400 });
    expect(writes).toEqual([]);
    expect(syncInsuranceReminder).not.toHaveBeenCalled();
  });

  it.each(["foreign-policy", "missing-policy"])(
    "refuses a claim linked to %s before writing",
    async (policy) => {
      const { db, writes } = database();
      const result = await expenses.saveClaim(
        event(db, { policy_id: policy, claim_date: "2026-10-23" }) as never,
      );
      expect(result).toMatchObject({ status: 404 });
      expect(writes).toEqual([]);
    },
  );

  it("saves a claim only after locking the owner's policy in the same transaction", async () => {
    const { db, writes } = database();
    expect(
      await expenses.saveClaim(
        event(db, {
          policy_id: "own-policy",
          claim_date: "2026-10-23",
        }) as never,
      ),
    ).toMatchObject({ ok: true });
    expect(writes).toHaveLength(1);
    expect(writes[0].policy_id).toBe("own-policy");
  });
});
