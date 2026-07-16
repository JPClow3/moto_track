import { describe, expect, it } from "vitest";
import { offlineFuelValues } from "$lib/utils/offline-fuel";

describe("offlineFuelValues", () => {
  it("keeps the data required to replay a fuel submission", () => {
    const form = new FormData();
    form.set("date", "2026-07-16");
    form.set("odometer_km", "32000");
    form.set("liters", "12.4");
    form.set("total_price", "78.50");
    form.set("tank_full", "true");

    expect(offlineFuelValues(form)).toMatchObject({ odometer_km: "32000", tank_full: "true" });
  });

  it("rejects a non-empty receipt because the queue only persists structured data", () => {
    const form = new FormData();
    form.set("date", "2026-07-16");
    form.set("odometer_km", "32000");
    form.set("liters", "12.4");
    form.set("total_price", "78.50");
    form.set("receipt_file", new File(["receipt"], "receipt.txt", { type: "text/plain" }));

    expect(() => offlineFuelValues(form)).toThrow("comprovante");
  });
});
