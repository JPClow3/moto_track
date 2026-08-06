import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  groupCatalogModels,
  type MotorcycleCatalogPreview,
} from "$server/domain/motorcycle-catalog";

const modelMigration = readFileSync(
  new URL(
    "../../db/migrations/20260806090000_model_first_catalog.sql",
    import.meta.url,
  ),
  "utf8",
);

function preview(
  overrides: Partial<MotorcycleCatalogPreview> &
    Pick<MotorcycleCatalogPreview, "id" | "model_id">,
): MotorcycleCatalogPreview {
  return {
    brand: "Honda",
    model: "CG 160",
    year_from: 2019,
    year_to: 2019,
    variant: "Start",
    generation: "",
    is_exact_schedule: false,
    is_catalog_visible: true,
    model_display_name: "CG 160 Start",
    model_variant: "Start",
    manual_url: "https://example.invalid/manual.pdf",
    document_version: "D2203",
    page_reference: "p. 32",
    last_verified_date: "2026-07-26",
    coverage_notes: "",
    maintenance_count: 0,
    ...overrides,
  };
}

// The picker used to render one option per template row, so a single
// motorcycle appeared as "CG 160 Start · 2019" and "CG 160 Start · 2018"
// alongside a sales-line row — three entries for what a rider reads as one
// model, with the year repeated in a label the form asks for separately.
describe("catalogue model grouping", () => {
  it("collapses one model's years into a single entry with no year in the label", () => {
    const models = groupCatalogModels(
      [
        preview({
          id: "t-2019",
          model_id: "m-start",
          year_from: 2019,
          year_to: 2019,
          is_exact_schedule: true,
        }),
        preview({
          id: "t-2018",
          model_id: "m-start",
          year_from: 2018,
          year_to: 2018,
          is_exact_schedule: true,
        }),
      ],
      2026,
    );

    expect(models).toHaveLength(1);
    expect(models[0].displayName).toBe("CG 160 Start");
    expect(models[0].displayName).not.toMatch(/\d{4}/);
    expect(models[0].years).toEqual([2019, 2018]);
    expect(models[0].templatesByYear[2019].id).toBe("t-2019");
    expect(models[0].templatesByYear[2018].id).toBe("t-2018");
  });

  it("prefers the exact schedule when a sales line covers the same year", () => {
    const models = groupCatalogModels(
      [
        preview({
          id: "line",
          model_id: "m",
          model_display_name: "CG 150 / CG 160",
          year_from: 2006,
          year_to: 2026,
          is_exact_schedule: false,
        }),
        preview({
          id: "exact",
          model_id: "m",
          model_display_name: "CG 150 / CG 160",
          year_from: 2019,
          year_to: 2019,
          is_exact_schedule: true,
        }),
      ],
      2026,
    );

    expect(models[0].templatesByYear[2019].id).toBe("exact");
    // The wider row still fills the years the exact one does not cover.
    expect(models[0].templatesByYear[2020].id).toBe("line");
    expect(models[0].hasExactSchedule).toBe(true);
  });

  it("never offers a year beyond the current one", () => {
    const models = groupCatalogModels(
      [preview({ id: "t", model_id: "m", year_from: 2024, year_to: 2030 })],
      2026,
    );
    expect(models[0].years).toEqual([2026, 2025, 2024]);
  });

  it("keeps models with a verified schedule above sales lines within a brand", () => {
    const models = groupCatalogModels(
      [
        preview({
          id: "line",
          model_id: "m-line",
          model_display_name: "Biz 125",
          is_exact_schedule: false,
        }),
        preview({
          id: "exact",
          model_id: "m-exact",
          model_display_name: "CG 160 Start",
          is_exact_schedule: true,
        }),
      ],
      2026,
    );
    expect(models.map((model) => model.displayName)).toEqual([
      "CG 160 Start",
      "Biz 125",
    ]);
  });

  it("points both verified CG 160 Start years at one model row", () => {
    expect(modelMigration).toContain(
      "create table if not exists public.motorcycle_models",
    );
    expect(modelMigration).toContain("display_name");
    // Templates d011 (2019) and d012 (2018) must share model e011, otherwise
    // the picker would still show the model twice.
    const startModel = "0f0bb40e-0aec-4b09-a3f0-2ddc3cafe011";
    expect(modelMigration).toContain(
      `('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011'::uuid, '${startModel}'::uuid)`,
    );
    expect(modelMigration).toContain(
      `('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012'::uuid, '${startModel}'::uuid)`,
    );
  });

  it("refuses to publish a catalogue template that no model can resolve", () => {
    expect(modelMigration).toContain(
      "motorcycle_templates_visible_needs_model",
    );
    expect(modelMigration).toContain(
      "check (not is_catalog_visible or model_id is not null)",
    );
  });

  it("keeps the migration re-runnable and free of RLS syntax", () => {
    expect(modelMigration).toContain("on conflict (id) do update set");
    expect(modelMigration).not.toMatch(/row level security/i);
    expect(modelMigration).not.toMatch(/create policy/i);
    expect(modelMigration).toContain("set search_path = ''");
  });
});
