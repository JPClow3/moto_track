import { describe, expect, it } from "vitest";
import {
  parseFuelCsv,
  parseReceiptText,
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
});
