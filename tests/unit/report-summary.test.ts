import { describe, expect, it } from "vitest";
import { summarizeReportMetrics } from "../../src/lib/server/domain/report-summary";

describe("report summary", () => {
  it("groups fuel consumption and every spending category by month", () => {
    const summary = summarizeReportMetrics({
      fuel: [
        { date: "2026-01-04", liters: 10, total_price_cents: 6000 },
        { date: "2026-01-20", liters: 5, total_price_cents: 3500 },
      ],
      maintenance: [{ date: "2026-01-12", cost_cents: 15000 }],
      tires: [{ installed_at: "2026-02-01", cost_cents: 80000 }],
      fees: [{ due_date: "2026-02-10", amount_cents: 12000 }],
    });

    expect(summary.distribution).toEqual([
      { label: "Abastecimento", amountCents: 9500 },
      { label: "Manutenção", amountCents: 15000 },
      { label: "Pneus", amountCents: 80000 },
      { label: "Taxas e seguro", amountCents: 12000 },
    ]);
    expect(summary.months).toEqual([
      { month: "2026-01", fuelLiters: 15, spendingCents: 24500 },
      { month: "2026-02", fuelLiters: 0, spendingCents: 92000 },
    ]);
  });
});
