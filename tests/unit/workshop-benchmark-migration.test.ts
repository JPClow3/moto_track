import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "../../db/migrations/20261023120000_workshop_benchmarks.sql",
    import.meta.url,
  ),
  "utf8",
);
const anonymous = sql
  .split("create table public.anonymous_workshop_benchmark_contributions (")[1]
  .split("\n);")[0];
const summary = sql.split(
  "create function public.workshop_benchmark_summary",
)[1];

describe("workshop comparison database privacy contract", () => {
  it("keeps owner and source identifiers out of the observation table, with cascading cleanup", () => {
    expect(anonymous).not.toContain("owner_id");
    expect(anonymous).not.toContain("record_id");
    expect(anonymous).toContain(
      "references public.workshop_benchmark_submission_guards(contribution_id) on delete cascade",
    );
    expect(sql).toContain(
      'owner_id uuid not null references neon_auth."user"(id) on delete cascade',
    );
    expect(sql).toContain(
      "record_id uuid not null references public.maintenance_records(id) on delete cascade",
    );
    expect(sql).toContain("primary key (owner_id, record_id)");
  });

  it("counts distinct valid accounts for each workshop and filters both service and full region", () => {
    expect(summary).toContain("having count(distinct p.owner_id) >= 5");
    expect(summary).toContain("group by c.workshop_key, g.owner_id");
    expect(summary).toContain("round(avg(p.average_labor_cents), 0)");
    expect(summary).toContain(
      "c.service_key = p_service_key and c.city_key = p_city_key",
    );
    expect(summary).toContain("c.state_code = p_state_code");
    expect(summary).toContain("r.id = g.record_id and r.owner_id = g.owner_id");
  });

  it("excludes changed source records, impossible labor splits and future or non-BRL records", () => {
    for (const clause of [
      "r.workshop = g.source_workshop",
      "r.maintenance_type = g.source_service",
      "r.date = g.serviced_on",
      "r.cost_cents = g.source_total_cents",
      "r.currency = 'BRL'",
      "r.date <= current_date",
      "c.labor_cents <= r.cost_cents",
    ]) {
      expect(summary).toContain(clause);
    }
    expect(summary).toContain(
      "revoke all on function public.workshop_benchmark_summary(text, text, text) from public",
    );
  });
});
