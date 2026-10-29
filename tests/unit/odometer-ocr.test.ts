import { describe, expect, it, vi } from "vitest";
import { extractOcrText, parseOdometerText } from "$server/domain/fuel";

describe("parseOdometerText", () => {
  it("reads a kilometre display with thousands separators", () => {
    expect(parseOdometerText("Painel: odômetro 32.450 km")).toBe(32450);
  });

  it("does not treat unrelated text as an odometer", () => {
    expect(parseOdometerText("Total R$ 325,00")).toBeNull();
  });
  it("prefers the total odometer over a trip meter and refuses ambiguous unlabeled readings", () => {
    expect(parseOdometerText("TRIP: 125 km\nODO 32450 km")).toBe(32450);
    expect(parseOdometerText("125 km\n32450 km")).toBeNull();
    expect(parseOdometerText("TRIP 125 km")).toBeNull();
  });
  it("does not mistake speed or miles for a kilometre odometer", () => {
    expect(parseOdometerText("80 km/h")).toBeNull();
    expect(parseOdometerText("ODO 32450 miles")).toBeNull();
  });
  it("extracts a panel reading from image OCR without persisting the result", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          pages: [{ markdown: "TRIP 125 km\nODO 32.450 km" }],
        }),
        { status: 200 },
      ),
    );
    const file = new File(["image fixture"], "dashboard.jpg", {
      type: "image/jpeg",
    });
    expect(
      parseOdometerText(await extractOcrText(file, { apiKey: "test", fetch })),
    ).toBe(32450);
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
      document: { type: "image_url" },
    });
    expect(fetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
