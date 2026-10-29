import { describe, expect, it, vi } from "vitest";
import type { Action } from "@sveltejs/kit";
import { actions as fuel } from "../../src/routes/(app)/fuel/+page.server";
import { actions as tires } from "../../src/routes/(app)/tires/+page.server";
import { actions as work } from "../../src/routes/(app)/trabalho/+page.server";

vi.mock("$server/domain/odometer", () => ({ syncMotorcycleOdometer: vi.fn() }));

function database() {
  const writes: Array<{ table: string; transactional: boolean }> = [];
  let transactional = false;
  const queryDb = (input: unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(input)) return input;
    const query = input.join("?");
    if (query.includes('select id from neon_auth."user"'))
      return Promise.resolve(values[0] === "owner" ? [{ id: "owner" }] : []);
    if (query.includes("select id from motorcycles"))
      return Promise.resolve(
        ["owned", "archived"].includes(String(values[0])) &&
          values[1] === "owner"
          ? [{ id: values[0] }]
          : [],
      );
    if (query.includes("select id from ?"))
      return Promise.resolve(
        values[1] === "owned" && values[2] === "owner" ? [{ id: "owned" }] : [],
      );
    if (query.includes("insert into")) {
      writes.push({
        table: query.match(/insert into (\w+)/)?.[1] ?? "unknown",
        transactional,
      });
      return Promise.resolve([{ id: "record" }]);
    }
    return Promise.resolve([]);
  };
  const db = Object.assign(queryDb, {
    begin: async (callback: (sql: unknown) => Promise<unknown>) => {
      transactional = true;
      const before = writes.length;
      try {
        return await callback(queryDb);
      } catch (cause) {
        writes.length = before;
        throw cause;
      } finally {
        transactional = false;
      }
    },
  });
  return { db, writes };
}

const importRows = JSON.stringify([
  {
    date: "2026-10-23",
    odometer_km: 1000,
    liters: 5,
    total_price_cents: 3000,
    price_per_liter_millicents: 600000,
    fuel_type: "gasoline",
    tank_full: true,
    station_name: "original",
    notes: "",
  },
]);
const makeEvent = (db: unknown, values: Record<string, string>) => ({
  locals: { db, user: { id: "owner" }, locale: "pt-BR" },
  request: new Request("https://app.test/record", {
    method: "POST",
    body: new URLSearchParams(values),
  }),
});

describe("custom action owner references", () => {
  const actions: Array<{
    name: string;
    action: Action | undefined;
    values: Record<string, string>;
  }> = [
    {
      name: "pressure",
      action: tires.savePressure,
      values: { date: "2026-10-23", psi_front: "30", psi_rear: "32" },
    },
    {
      name: "professional costs",
      action: work.saveCosts,
      values: {
        maintenance_reserve: "0.1",
        depreciation: "0.1",
        fixed_daily_cost: "5",
      },
    },
    {
      name: "fuel create",
      action: fuel.createRecord,
      values: {
        date: "2026-10-23",
        liters: "5",
        odometer_km: "1000",
        total_price: "30",
      },
    },
    {
      name: "fuel import",
      action: fuel.importConfirm,
      values: { rows_json: importRows },
    },
    {
      name: "fuel defaults",
      action: fuel.saveDefaults,
      values: { fuel_type: "gasoline" },
    },
    {
      name: "fuel review",
      action: fuel.saveReviewSettings,
      values: { fillups_interval: "10", is_active: "true" },
    },
  ];
  for (const candidate of actions) {
    it.each(["foreign", "missing", "deleted"])(
      `${candidate.name} rejects %s motorcycle before any write`,
      async (motorcycle) => {
        const { db, writes } = database();
        const result = await candidate.action!(
          makeEvent(db, {
            ...candidate.values,
            motorcycle_id: motorcycle,
          }) as never,
        );
        expect(result).toMatchObject({ status: 400 });
        expect(writes).toEqual([]);
      },
    );
    it(`${candidate.name} accepts the owner's archived motorcycle transactionally`, async () => {
      const { db, writes } = database();
      const result = await candidate.action!(
        makeEvent(db, {
          ...candidate.values,
          motorcycle_id: "archived",
        }) as never,
      );
      expect(result).toMatchObject({ ok: true });
      expect(writes.length).toBeGreaterThan(0);
      expect(writes[0].transactional).toBe(true);
    });
  }

  for (const action of [fuel.createRecord, fuel.saveDefaults]) {
    it.each(["station_id", "fuel_grade_id"])(
      "rejects a foreign %s before a fuel write",
      async (key) => {
        const { db, writes } = database();
        const result = await action!(
          makeEvent(db, {
            motorcycle_id: "owned",
            station_id: "owned",
            fuel_grade_id: "owned",
            date: "2026-10-23",
            liters: "5",
            odometer_km: "1000",
            total_price: "30",
            [key]: "foreign",
          }) as never,
        );
        expect(result).toMatchObject({ status: 400 });
        expect(writes).toEqual([]);
      },
    );
    it("preserves nullable fuel references", async () => {
      const { db, writes } = database();
      expect(
        await action!(
          makeEvent(db, {
            date: "2026-10-23",
            liters: "5",
            odometer_km: "1000",
            total_price: "30",
          }) as never,
        ),
      ).toMatchObject({ ok: true });
      expect(writes.length).toBeGreaterThan(0);
    });
  }
});
