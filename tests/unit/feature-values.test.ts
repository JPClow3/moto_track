import { describe, expect, it } from "vitest";
import {
  dateOnlyValue,
  editFieldValue,
  moneyStep,
} from "../../src/lib/utils/feature-values";
import { normalizeFeaturePayload } from "../../src/lib/server/domain/crud";
import { getFeature } from "../../src/lib/server/domain/features";

describe("feature edit values", () => {
  it("prefills money in currency units so saving does not multiply by 100", () => {
    expect(editFieldValue("money", "amount_cents", 15000)).toBe("150");
    expect(editFieldValue("money", "cost_cents", 1999)).toBe("19.99");
    expect(editFieldValue("money", "price_per_liter_millicents", 678900)).toBe(
      "6.789",
    );
    expect(moneyStep("price_per_liter_millicents")).toBe("0.001");
  });

  it("round-trips an untouched expense through the edit form", () => {
    const feature = getFeature("expenses");
    const stored: Record<string, unknown> = {
      amount_cents: 15000,
      due_date: new Date("2026-03-10T00:00:00.000Z"),
    };
    const form = new FormData();
    for (const field of feature.fields) {
      if (field.kind === "file" || field.kind === "boolean") continue;
      const value =
        field.key in stored
          ? editFieldValue(field.kind, field.key, stored[field.key])
          : field.kind === "select" && field.options?.length
            ? field.options[0].value
            : field.kind === "number"
              ? "2026"
              : field.kind === "date"
                ? "2026-03-10"
                : "x";
      form.set(field.key, value);
    }
    const normalized = normalizeFeaturePayload(feature, form, { id: "owner" });
    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.payload.amount_cents).toBe(15000);
      expect(normalized.payload.due_date).toBe("2026-03-10");
    }
  });

  it("turns a midnight-UTC Date from postgres.js into its calendar day", () => {
    const value = new Date("2026-10-28T00:00:00.000Z");
    expect(dateOnlyValue(value)).toBe("2026-10-28");
    expect(editFieldValue("date", "date", value)).toBe("2026-10-28");
    expect(dateOnlyValue("2026-10-28")).toBe("2026-10-28");
    expect(dateOnlyValue("not a date")).toBeNull();
  });
});
