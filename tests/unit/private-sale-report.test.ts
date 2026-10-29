import { describe, expect, it } from "vitest";
import { load } from "../../src/routes/(app)/reports/sale/[motorcycleId]/+page.server";

const sources = [
  "motorcycles",
  "fuel_records",
  "maintenance_records",
  "tire_records",
  "annual_fees",
];

function event(failingTable?: string) {
  const unavailable = new Error("Database temporarily unavailable");
  const db = (strings: TemplateStringsArray) => {
    const query = strings.join("?");
    if (failingTable && query.includes(`from ${failingTable}`))
      return Promise.reject(unavailable);
    if (query.includes("from motorcycles"))
      return Promise.resolve([{ id: "bike", name: "My bike" }]);
    if (query.includes("from fuel_records"))
      return Promise.resolve([{ total_price_cents: 100 }]);
    if (query.includes("from annual_fees"))
      return Promise.resolve([{ amount_cents: 200 }]);
    return Promise.resolve([{ cost_cents: 300 }]);
  };
  return {
    unavailable,
    value: {
      locals: { user: { id: "owner" }, db, locale: "en" },
      params: { motorcycleId: "bike" },
    },
  };
}

describe("printable ownership report", () => {
  it("returns totals only when every source was read successfully", async () => {
    const { value } = event();
    const report = await load(value as never);
    expect(report.totals).toEqual({
      fuel: 100,
      maintenance: 300,
      tires: 300,
      fees: 200,
    });
  });

  it.each(sources)(
    "does not turn an unavailable %s lookup into a successful zero total",
    async (table) => {
      const { value, unavailable } = event(table);
      await expect(load(value as never)).rejects.toBe(unavailable);
    },
  );
});
