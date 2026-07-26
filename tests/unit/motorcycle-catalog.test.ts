import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dueStateForPlan,
  initialHistoryStatus,
} from "$server/domain/motorcycle-catalog";

const migration = readFileSync(
  new URL(
    "../../db/migrations/20260726210000_exact_manual_sources_and_initial_history.sql",
    import.meta.url,
  ),
  "utf8",
);
const coverageMigration = readFileSync(
  new URL(
    "../../db/migrations/20260726220000_expand_exact_cg160_schedule_coverage.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("seeded motorcycle catalogue", () => {
  it("adds a source record and an exact schedule instead of another family rule", () => {
    expect(migration).toContain("motorcycle_manual_sources");
    expect(migration).toContain("official_url");
    expect(migration).toContain("document_version");
    expect(migration).toContain("page_reference");
    expect(migration).toContain("last_verified_date");
    expect(migration).toContain("CG 160");
    expect(migration).toContain("'Start'");
    expect(migration).toContain("is_exact_schedule");
  });

  it("keeps the official direct manual and links each seeded item to it", () => {
    expect(migration).toContain("D2203-MAN-1186_WEB");
    expect(migration).toContain("manual_source_id");
    expect(migration).toContain("estimated_cost_cents");
    expect(migration).toContain("Óleo do motor");
  });

  it("keeps 2018 and 2019 as separate exact schedules with their own source versions", () => {
    expect(coverageMigration).toContain("CG 160 Start 2018");
    expect(coverageMigration).toContain("D2203-MAN-1109");
    expect(coverageMigration).toContain("Não indicada no manual");
    expect(coverageMigration).toContain(
      "motorcycle_manual_sources_set_updated_at",
    );
  });

  it("does not mirror manufacturer PDFs into the application", () => {
    expect(migration).toContain("direct Honda PDF");
    expect(migration).not.toContain("bytea");
  });

  it("does not infer a service history for a 50,000 km motorcycle", () => {
    expect(initialHistoryStatus("not_done")).toBe("not_done");
    expect(initialHistoryStatus("anything-else")).toBe("unknown");
    expect(
      dueStateForPlan({
        historyStatus: "unknown",
        lastDoneKm: null,
        intervalKm: 6000,
        currentKm: 50_000,
      }),
    ).toEqual({ urgency: "due_now", dueKm: null });
    expect(
      dueStateForPlan({
        historyStatus: "not_done",
        lastDoneKm: null,
        intervalKm: 6000,
        currentKm: 50_000,
      }),
    ).toEqual({ urgency: "overdue", dueKm: null });
    expect(
      dueStateForPlan({
        historyStatus: "confirmed_done",
        lastDoneKm: 50_000,
        intervalKm: 6000,
        currentKm: 50_000,
      }),
    ).toEqual({ urgency: "scheduled", dueKm: 56_000 });
  });
});
