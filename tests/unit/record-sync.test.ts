import { describe, expect, it } from "vitest";
import { reminderForRecord } from "../../src/lib/server/domain/record-sync";

describe("linked reminder definitions", () => {
  it("creates a recurring interval reminder from maintenance data", () => {
    expect(
      reminderForRecord("maintenance_records", "record-1", {
        motorcycle_id: "moto-1",
        maintenance_type: "oil",
        date: "2026-07-11",
        odometer_km: 12000,
        interval_km: 3000,
        interval_days: 180,
      }),
    ).toMatchObject({
      trigger_type: "by_interval",
      trigger_value_km: 3000,
      trigger_value_days: 180,
      reference_km: 12000,
      reference_date: "2026-07-11",
      is_recurring: true,
    });
  });

  it("schedules a document reminder before its expiry date", () => {
    expect(
      reminderForRecord("motorcycle_documents", "document-1", {
        motorcycle_id: "moto-1",
        name: "Seguro",
        valid_until: "2026-08-10",
        notify_before_days: 30,
      }),
    ).toMatchObject({
      trigger_type: "by_date",
      trigger_value_days: 0,
      reference_date: "2026-07-11",
      is_recurring: false,
    });
  });
});
