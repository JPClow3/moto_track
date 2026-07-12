import { describe, expect, it } from "vitest";
import { healthScore, dashboardSummary } from "../../src/lib/server/domain/reports";

describe("reports domain", () => {
  describe("healthScore", () => {
    it("returns perfect score when no issues exist", () => {
      const score = healthScore({
        reminders: [],
        currentOdometerKm: 15000,
        today: "2026-07-12",
        tireWear: [],
        documentsExpiring: 0,
      });

      expect(score).toEqual({
        total: 100,
        readable_status: "Pronta para rodar",
      });
    });

    it("penalizes for overdue reminders and tire wear", () => {
      const score = healthScore({
        reminders: [
          { trigger_type: "by_km", reference_km: 10000, trigger_value_km: 4000 } // overdue at 15000 (10000+4000 < 15000)
        ],
        currentOdometerKm: 15000,
        today: "2026-07-12",
        tireWear: [90, 75], // one critical tire (>85), one worn tire (>70)
        documentsExpiring: 1, // one document expiring
      });

      // Penalties:
      // Overdue reminder: 15
      // Tire wear >= 85: 12
      // Tire wear >= 70: 6
      // Document expiring: 5
      // Total penalties = 15 + 12 + 6 + 5 = 38
      // Final score = 100 - 38 = 62
      
      expect(score.total).toBe(62);
      expect(score.readable_status).toBe("Atenção em breve");
    });
    
    it("drops status to 'Manutenção vencida' if score is below 50", () => {
      const score = healthScore({
        reminders: [
          { trigger_type: "by_km", reference_km: 10000, trigger_value_km: 4000 }, // overdue (-15)
          { trigger_type: "by_date", reference_date: "2026-06-01", trigger_value_days: 0 }, // overdue (-15)
        ],
        currentOdometerKm: 15000,
        today: "2026-07-12",
        tireWear: [90, 90], // two critical tires (-24)
        documentsExpiring: 0,
      });

      // Total penalties = 15 + 15 + 12 + 12 = 54
      // Score = 46
      expect(score.total).toBe(46);
      expect(score.readable_status).toBe("Manutenção vencida");
    });
  });

  describe("dashboardSummary", () => {
    it("calculates summary statistics correctly", () => {
      const fuelRecords = [
        { date: "2026-07-01", odometer_km: 1000, liters: 10, total_price_cents: 5000, tank_full: true },
        { date: "2026-07-05", odometer_km: 1200, liters: 5, total_price_cents: 2500, tank_full: false },
        { date: "2026-07-10", odometer_km: 1400, liters: 15, total_price_cents: 7500, tank_full: true },
      ];
      
      const summary = dashboardSummary(fuelRecords);
      expect(summary.fuel_spend_cents).toBe(15000); // 5000 + 2500 + 7500
      expect(summary.average_consumption_km_l).toBe(20); // 400km / 20L
      expect(summary.cost_per_km).toBe(0.375); // 150 BRL / 400km
    });
  });
});
