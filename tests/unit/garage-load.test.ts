import { describe, expect, it, vi } from "vitest";

vi.mock("$server/domain/motorcycle-catalog", () => ({
  applyMotorcycleTemplate: vi.fn(),
  initialHistoryStatus: vi.fn(),
  loadCatalogModels: vi.fn(async () => []),
  resolveCatalogSelection: vi.fn(),
}));

import { load } from "../../src/routes/(app)/garage/+page.server";

const activeBike = {
  id: "bike-active",
  owner_id: "owner-1",
  name: "Daily",
  is_active: true,
  deleted_at: null,
  source_template_id: null,
};
// What the garage `archive` action leaves behind (`archiveMotorcycle()`).
const archivedBike = {
  id: "bike-archived",
  owner_id: "owner-1",
  name: "Old",
  is_active: false,
  deleted_at: "2026-07-14T12:00:00.000Z",
  source_template_id: null,
};

function database(motorcycles: Record<string, unknown>[]) {
  const queries: string[] = [];
  const db = ((first: unknown) => {
    // `db(array)` is postgres.js's value helper for `in ${...}` lists.
    if (!Array.isArray(first) || !("raw" in first)) return first;
    const sql = (first as string[]).join("?").replaceAll(/\s+/g, " ").trim();
    queries.push(sql);
    if (sql.startsWith("select * from motorcycles"))
      return Promise.resolve(motorcycles);
    return Promise.resolve([]);
  }) as unknown as App.Locals["db"];
  return { db, queries };
}

async function loadGarage(motorcycles: Record<string, unknown>[]) {
  const { db, queries } = database(motorcycles);
  const data = await load({
    locals: { db, user: { id: "owner-1" }, locale: "pt-BR" },
    platform: undefined,
  } as unknown as Parameters<typeof load>[0]);
  return { data, queries };
}

describe("garage load", () => {
  it("keeps archived (soft-deleted) motorcycles so they can be restored", async () => {
    const { data, queries } = await loadGarage([activeBike, archivedBike]);

    expect(data.motorcycles.map((motorcycle) => motorcycle.id)).toEqual([
      "bike-active",
      "bike-archived",
    ]);
    const listing = queries.find((sql) =>
      sql.startsWith("select * from motorcycles"),
    );
    expect(listing).not.toContain("deleted_at");
    // Specs are still looked up for the archived card.
    const specs = queries.find((sql) => sql.includes("motorcycle_specs"));
    expect(specs).toBeDefined();
  });

  it("does not count an archived motorcycle against the Free active slot", async () => {
    const { data } = await loadGarage([archivedBike]);

    expect(data.canAddActive).toBe(true);
  });
});
