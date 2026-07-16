import { describe, expect, it } from "vitest";
import { detectFuelPriceAnomalies } from "../../src/lib/server/domain/fuel";

describe("fuel price anomalies", () => {
  it("marks a fill-up priced materially above the recent baseline", () => {
    const anomalies = detectFuelPriceAnomalies([
      { id: "a", date: "2026-07-01", price_per_liter_millicents: 500000 },
      { id: "b", date: "2026-07-02", price_per_liter_millicents: 510000 },
      { id: "c", date: "2026-07-03", price_per_liter_millicents: 650000 },
    ]);

    expect(anomalies.get("c")).toContain("acima");
    expect(anomalies.has("a")).toBe(false);
  });
});
