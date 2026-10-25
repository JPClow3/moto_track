import { describe, expect, it } from "vitest";
import { nearbyStations, coordinate } from "$lib/domain/nearby-stations";

describe("nearby recorded fuel prices", () => {
  const stations = [
    { id: "a", name: "A", latitude: 0, longitude: 0 },
    { id: "b", name: "B", latitude: 0.01, longitude: 0 },
    { id: "c", name: "Sem localização", latitude: null, longitude: null },
  ];
  const options = {
    latitude: 0,
    longitude: 0,
    radiusKm: 5,
    fuelType: "gasoline",
    today: "2026-10-23",
  };
  const fill = (
    station_id: string,
    price: number,
    date = "2026-10-22",
    fuel_type = "gasoline",
  ) => ({ station_id, price_per_liter_millicents: price, date, fuel_type });
  it("compares the latest price for the selected fuel rather than historical low prices", () => {
    const result = nearbyStations(
      stations,
      [
        fill("a", 400000, "2026-10-01"),
        fill("a", 600000),
        fill("a", 300000, "2026-10-23", "ethanol"),
        fill("b", 550000),
      ],
      options,
    );
    expect(result.map((r) => [r.name, r.priceMillicents])).toEqual([
      ["B", 550000],
      ["A", 600000],
    ]);
  });
  it("excludes missing coordinates, stale observations, future dates and remote stations", () => {
    const records = [
      fill("a", 400000, "2026-08-01"),
      fill("a", 500000, "2026-11-01"),
      fill("b", 550000),
      fill("c", 100000),
    ];
    expect(
      nearbyStations(stations, records, { ...options, radiusKm: 0.5 }),
    ).toEqual([]);
    expect(coordinate(null, 90)).toBeNull();
    expect(coordinate("", 90)).toBeNull();
    expect(coordinate(0, 90)).toBe(0);
  });
  it("compares only the selected fuel grade", () => {
    const records = [
      { ...fill("a", 600000), fuel_grade_id: "premium" },
      fill("a", 500000),
      { ...fill("b", 650000), fuel_grade_id: "premium" },
    ];
    expect(
      nearbyStations(stations, records, options).map((r) => r.priceMillicents),
    ).toEqual([500000]);
    expect(
      nearbyStations(stations, records, {
        ...options,
        fuelGradeId: "premium",
      }).map((r) => r.priceMillicents),
    ).toEqual([600000, 650000]);
  });
});
