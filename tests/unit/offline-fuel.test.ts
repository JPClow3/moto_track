import { describe, expect, it } from "vitest";
import {
  offlineFuelValues,
  offlineDraftScope,
  offlineFuelExport,
  prepareLegacyFuelDraft,
} from "$lib/utils/offline-fuel";

describe("offlineFuelValues", () => {
  it("keeps the data required to replay a fuel submission", () => {
    const form = new FormData();
    form.set("date", "2026-07-16");
    form.set("odometer_km", "32000");
    form.set("liters", "12.4");
    form.set("total_price", "78.50");
    form.set("tank_full", "true");

    expect(offlineFuelValues(form)).toMatchObject({
      odometer_km: "32000",
      tank_full: "true",
    });
  });

  it("rejects a non-empty receipt because the queue only persists structured data", () => {
    const form = new FormData();
    form.set("date", "2026-07-16");
    form.set("odometer_km", "32000");
    form.set("liters", "12.4");
    form.set("total_price", "78.50");
    form.set(
      "receipt_file",
      new File(["receipt"], "receipt.txt", { type: "text/plain" }),
    );

    expect(() => offlineFuelValues(form)).toThrow("comprovante");
    expect(() => offlineFuelValues(form, "en")).toThrow("receipt");
  });

  it("localizes missing-field feedback without changing structured values", () => {
    expect(() => offlineFuelValues(new FormData(), "en")).toThrow(
      "Complete the required fields",
    );
  });
});

describe("legacy local draft recovery", () => {
  const draft = {
    id: "f03ec98b-6c67-45f9-8fbb-e95857c3d01c",
    createdAt: "2026-10-23T12:00:00.000Z",
    values: {
      date: "2026-10-22",
      odometer_km: "32000",
      liters: "12.4",
      total_price: "78.50",
      station_id: "old-station",
      fuel_grade_id: "old-grade",
      notes: "<script>private rider note</script>",
    },
  };
  const review = () => {
    const form = new FormData();
    for (const [key, value] of Object.entries(draft.values))
      form.set(key, value);
    return form;
  };
  it("distinguishes unassigned, current and other accounts without assigning on login", () => {
    expect(offlineDraftScope(draft, "current")).toBe("unknown");
    expect(offlineDraftScope({ ...draft, ownerId: "current" }, "current")).toBe(
      "current",
    );
    expect(
      offlineDraftScope({ ...draft, ownerId: "original" }, "current"),
    ).toBe("other");
    expect(offlineDraftScope({ ...draft, ownerId: "original" }, null)).toBe(
      "other",
    );
  });
  it("requires explicit review consent and preserves the stable identifier while dropping old relationships", () => {
    expect(() =>
      prepareLegacyFuelDraft(draft, review(), "current", false, "en"),
    ).toThrow("explicitly confirm");
    expect(() =>
      prepareLegacyFuelDraft(draft, review(), null, true, "en"),
    ).toThrow("Sign in");
    const result = prepareLegacyFuelDraft(
      draft,
      review(),
      "current",
      true,
      "en",
    );
    expect(result.id).toBe(draft.id);
    expect(result.ownerId).toBe("current");
    expect(result.values.notes).toBe(draft.values.notes);
    expect(result.values.station_id).toBeUndefined();
    expect(result.values.fuel_grade_id).toBeUndefined();
    expect(draft).not.toHaveProperty("ownerId");
  });
  it("never adopts another account's or a missing-file draft", () => {
    expect(() =>
      prepareLegacyFuelDraft(
        { ...draft, ownerId: "original" },
        review(),
        "current",
        true,
        "en",
      ),
    ).toThrow("explicitly confirm");
    expect(() =>
      prepareLegacyFuelDraft(
        {
          ...draft,
          values: { ...draft.values, receipt_file_key: "unavailable.jpg" },
        },
        review(),
        "current",
        true,
        "en",
      ),
    ).toThrow("unavailable receipt");
  });
  it("exports a recoverable JSON copy with original identifiers and content", () => {
    const exported = JSON.parse(offlineFuelExport([draft]));
    expect(exported.format).toBe("moto-track-offline-fuel-v1");
    expect(exported.drafts).toEqual([draft]);
  });
});
