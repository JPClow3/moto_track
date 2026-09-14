import { describe, expect, it } from "vitest";
import {
  getFeature,
  schemaForFeature,
} from "../../src/lib/server/domain/features";
import {
  parseFormNumber,
  parseMoneyCents,
  parseMoneyMillicents,
} from "../../src/lib/server/domain/crud";

describe("motorcycle-linked features", () => {
  it("requires the user to select a motorcycle for operational records", () => {
    for (const slug of [
      "maintenance",
      "tires",
      "documents",
      "reminders",
      "expenses",
      "trabalho",
    ]) {
      expect(getFeature(slug).fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "motorcycle_id",
            kind: "select",
            required: true,
          }),
        ]),
      );
    }
  });

  it("parses localized comma numbers and money values in schema validation", () => {
    const maintenanceSchema = schemaForFeature(getFeature("maintenance"));
    const parsedComma = maintenanceSchema.safeParse({
      motorcycle_id: "moto-1",
      maintenance_type: "oil",
      date: "2026-07-10",
      odometer_km: "12000",
      cost_cents: "15,50",
    });
    expect(parsedComma.success).toBe(true);
    if (parsedComma.success) {
      expect(parsedComma.data.cost_cents).toBe(15.5);
      expect(parsedComma.data.odometer_km).toBe(12000);
    }

    const parsedDot = maintenanceSchema.safeParse({
      motorcycle_id: "moto-1",
      maintenance_type: "oil",
      date: "2026-07-10",
      odometer_km: 12000,
      cost_cents: "15.50",
    });
    expect(parsedDot.success).toBe(true);
    if (parsedDot.success) {
      expect(parsedDot.data.cost_cents).toBe(15.5);
    }
  });

  it("converts form numbers and money strings to integer cents/millicents cleanly", () => {
    expect(parseMoneyCents("150,00")).toBe(15000);
    expect(parseMoneyCents("1.250,50")).toBe(125050);
    expect(parseMoneyCents("45.90")).toBe(4590);
    expect(parseMoneyCents(null)).toBe(0);

    expect(parseMoneyMillicents("0,35")).toBe(35000);
    expect(parseMoneyMillicents("1.20")).toBe(120000);

    expect(parseFormNumber("32,5")).toBe(32.5);
    expect(parseFormNumber("32.5")).toBe(32.5);
    expect(parseFormNumber("invalid", 10)).toBe(10);
  });
});
