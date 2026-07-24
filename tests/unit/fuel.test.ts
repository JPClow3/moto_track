import { describe, expect, it } from "vitest";
import {
  parseFuelCsv,
  parseReceiptText,
  averageConsumption,
  costPerKm,
  parseFuelImportRows,
} from "../../src/lib/server/domain/fuel";

describe("fuel parsing", () => {
  it("extracts receipt fields from text", () => {
    const result = parseReceiptText(`
      Data 10/07/2026
      Litros: 12,500
      Total R$ 75,00
      Preco litro R$ 6,000
    `);

    expect(result).toEqual({
      date: "2026-07-10",
      liters: 12.5,
      total_price: 75,
      price_per_liter: 6,
    });
  });

  it("previews valid CSV rows with derived price per liter", () => {
    const rows = parseFuelCsv(
      "date,odometer_km,liters,total_price,station_name,tank_full\n2026-07-10,12000,10,65,Centro,true",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data.total_price_cents).toBe(6500);
    expect(rows[0].data.price_per_liter_millicents).toBe(650000);
    expect(rows[0].data.tank_full).toBe(true);
  });

  it("keeps quoted station names with commas and rejects bad dates", () => {
    const rows = parseFuelCsv(
      'date,odometer_km,liters,total_price,station_name\n2026-07-10,12000,10,65,"Posto Centro, SP"\n10/07/2026,12100,9,60,X',
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data.station_name).toBe("Posto Centro, SP");
    expect(rows[1].errors).toContain("Data inválida.");
  });

  it("rejects malformed and invalid browser-submitted import rows", () => {
    expect(parseFuelImportRows("not json")).toEqual({
      ok: false,
      message: "Import data is invalid.",
    });
    expect(
      parseFuelImportRows(
        JSON.stringify([
          {
            date: "2026-07-10",
            odometer_km: 12000,
            liters: 0,
            total_price_cents: 6500,
            price_per_liter_millicents: 650000,
            fuel_type: "gasoline",
            tank_full: true,
            station_name: "Centro",
            notes: "",
          },
        ]),
      ),
    ).toEqual({ ok: false, message: "Import data is invalid." });
  });
});

describe("fuel metrics", () => {
  it("calculates average consumption between full tanks", () => {
    const records = [
      { date: "2026-07-01", odometer_km: 1000, liters: 10, tank_full: true },
      { date: "2026-07-05", odometer_km: 1200, liters: 5, tank_full: false },
      { date: "2026-07-10", odometer_km: 1400, liters: 15, tank_full: true },
    ];

    // distance between full tanks: 1400 - 1000 = 400km
    // liters used between full tanks: 5 + 15 = 20 liters
    // average = 400 / 20 = 20 km/l
    expect(averageConsumption(records)).toBe(20);
  });

  it("returns null for average consumption if less than 2 full tanks", () => {
    const records = [
      { date: "2026-07-01", odometer_km: 1000, liters: 10, tank_full: true },
      { date: "2026-07-05", odometer_km: 1200, liters: 5, tank_full: false },
    ];
    expect(averageConsumption(records)).toBeNull();
  });

  it("calculates cost per km across all records", () => {
    const records = [
      {
        date: "2026-07-01",
        odometer_km: 1000,
        liters: 10,
        total_price_cents: 5000,
      },
      {
        date: "2026-07-10",
        odometer_km: 1200,
        liters: 10,
        total_price_cents: 6000,
      },
    ];

    // distance: 1200 - 1000 = 200km
    // total cost: 11000 cents = 110 BRL
    // cost per km = 110 / 200 = 0.55
    expect(costPerKm(records)).toBe(0.55);
  });

  it("returns null for cost per km if less than 2 records", () => {
    const records = [
      {
        date: "2026-07-01",
        odometer_km: 1000,
        liters: 10,
        total_price_cents: 5000,
      },
    ];
    expect(costPerKm(records)).toBeNull();
  });
});
