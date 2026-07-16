import { describe, expect, it } from "vitest";
import { parseOdometerText } from "$server/domain/fuel";

describe("parseOdometerText", () => {
  it("reads a kilometre display with thousands separators", () => {
    expect(parseOdometerText("Painel: odômetro 32.450 km")).toBe(32450);
  });

  it("does not treat unrelated text as an odometer", () => {
    expect(parseOdometerText("Total R$ 325,00")).toBeNull();
  });
});
