import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const initialMigration = readFileSync(
  new URL(
    "../../db/migrations/20260716103000_anonymous_model_benchmarks.sql",
    import.meta.url,
  ),
  "utf8",
);
const hardeningMigration = readFileSync(
  new URL(
    "../../db/migrations/20260801090000_harden_anonymous_model_benchmarks.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("anonymous model benchmark migration contract", () => {
  it("keeps owner_id out of the anonymous contribution table", () => {
    const tableBody = initialMigration.match(
      /create table public\.anonymous_model_benchmark_contributions\s*\(([^]*?)\);/i,
    )?.[1];
    expect(tableBody).toBeTruthy();
    expect(tableBody).not.toMatch(/owner_id/i);
  });

  it("deduplicates one account/model contribution without adding ownership to the cohort row", () => {
    expect(hardeningMigration).toMatch(
      /create table if not exists public\.model_benchmark_submission_guards/i,
    );
    expect(hardeningMigration).toMatch(
      /primary key\s*\(owner_id, model_key\)/i,
    );
    expect(hardeningMigration).toMatch(/unique\s*\(contribution_id\)/i);
  });

  it("uses independent contributor counts before releasing each metric average", () => {
    expect(hardeningMigration).toMatch(
      /count\(distinct g\.owner_id\)\s*filter\s*\(\s*where c\.consumption_km_l is not null\s*\)/i,
    );
    expect(hardeningMigration).toMatch(
      /count\(distinct g\.owner_id\)\s*filter\s*\(\s*where c\.maintenance_cents is not null\s*\)/i,
    );
    expect(hardeningMigration).toMatch(
      /case when count\(distinct g\.owner_id\) filter\s*\(\s*where c\.consumption_km_l is not null\s*\) >= 5/i,
    );
    expect(hardeningMigration).toMatch(
      /case when count\(distinct g\.owner_id\) filter\s*\(\s*where c\.maintenance_cents is not null\s*\) >= 5/i,
    );
  });
});
