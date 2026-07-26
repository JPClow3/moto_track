import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { manualScheduleAnchor } from "$server/domain/motorcycle-catalog";

const migration = readFileSync(
  new URL(
    "../../db/migrations/20260726190000_seed_motorcycle_catalog.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("seeded motorcycle catalogue", () => {
  it("contains the ten high-volume Brazilian model families", () => {
    const matches =
      migration.match(/0f0bb40e-0aec-4b09-a3f0-2ddc3cafd0\d{2}/g) ?? [];
    expect(new Set(matches).size).toBe(10);
    expect(migration).toContain("CG 150 / CG 160");
    expect(migration).toContain("Fazer 250");
  });

  it("keeps manufacturer-hosted manuals and a maintenance schedule per template", () => {
    expect(migration).toContain("honda.com.br/pos-venda/motos/manual-e-guia");
    expect(migration).toContain("yamaha-motor.com.br/manuais-e-catalogos");
    expect(migration).toContain("motorcycle_template_maintenance_items");
    expect(migration).toContain("Revisão periódica");
  });

  it("does not mirror manufacturer PDFs into the application", () => {
    expect(migration).toContain("must not be mirrored by the application");
  });

  it("aligns a pre-owned motorcycle to the next manual milestone", () => {
    expect(manualScheduleAnchor(50_000, 6_000)).toEqual({
      referenceKm: 48_000,
      nextDueKm: 54_000,
    });
    expect(manualScheduleAnchor(50_000, 1_000)).toEqual({
      referenceKm: 49_000,
      nextDueKm: 50_000,
    });
  });
});
