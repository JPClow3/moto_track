import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type ScheduleItem = {
  maintenance_type: string;
  interval_km: number | null;
  interval_days: number | null;
  notes: string;
  schedule_milestones: { km: number | null; months: number | null }[];
  recurrence_km: number | null;
  recurrence_months: number | null;
};
type SourceEntry = {
  id: string;
  model_id: string;
  brand: string;
  model: string;
  variant: string;
  year_from: number;
  year_to: number;
  is_exact_schedule: boolean;
  official_url: string;
  document_version: string;
  page_reference: string;
  coverage_notes: string;
  items: ScheduleItem[];
};

const migration = readFileSync(
  new URL(
    "../../db/migrations/20261023130000_expand_verified_exact_schedules.sql",
    import.meta.url,
  ),
  "utf8",
);
const entries = JSON.parse(migration.split("$catalog$")[1]) as SourceEntry[];
const replacementAnchors = readFileSync(
  new URL(
    "../../db/migrations/20261023140000_maintenance_replacement_calendar.sql",
    import.meta.url,
  ),
  "utf8",
);
const automatic = entries.filter((entry) => entry.is_exact_schedule);
const select = (model: string, year = 2025) => {
  const entry = entries.find(
    (candidate) => candidate.model === model && candidate.year_from === year,
  );
  if (!entry) throw new Error(`Missing source: ${model} ${year}`);
  return entry;
};
const item = (entry: SourceEntry, name: string) => {
  const result = entry.items.find(
    (candidate) => candidate.maintenance_type === name,
  );
  if (!result) throw new Error(`Missing item: ${entry.model} ${name}`);
  return result;
};

describe("official motorcycle schedule transcription", () => {
  it("restarts the three-year replacement age at the confirmed replacement", () => {
    expect(replacementAnchors).toContain(
      "calendar_anchor_mode = 'last_service'",
    );
    expect(replacementAnchors).toContain("mi.recurrence_months = 36");
    expect(replacementAnchors).toContain(
      "mi.maintenance_type = 'Mangueiras, líquido e vedações do arrefecimento'",
    );
    expect(replacementAnchors).toContain(
      "new.last_done_date + make_interval(months => new.recurrence_months)",
    );
  });

  it("publishes only independently documented years with supported cadence", () => {
    expect(automatic.map((entry) => [entry.model, entry.year_from])).toEqual([
      ["NH 190", 2025],
      ["NH 190", 2026],
      ["NH 300", 2025],
      ["NH 300", 2026],
    ]);
    for (const entry of automatic) {
      expect(entry.year_to).toBe(entry.year_from);
      expect(entry.official_url).toMatch(
        /^https:\/\/daframotos\.com\.br\/documentos\//,
      );
      expect(entry.coverage_notes).toContain("uso normal");
      expect(entry.coverage_notes).toContain("severas");
    }
  });

  it("preserves the 1000/3000 initial services instead of a false 3000km loop", () => {
    for (const entry of automatic) {
      const oil = item(entry, "Óleo do motor");
      expect(oil.schedule_milestones).toEqual([
        { km: 1000, months: 6 },
        { km: 3000, months: 12 },
      ]);
      expect(oil.recurrence_km).toBe(3000);
      expect(oil.recurrence_months).toBe(6);
      const replacement = item(entry, "Vela de ignição - troca");
      expect(replacement.schedule_milestones).toEqual([
        { km: 12000, months: 30 },
      ]);
      expect(replacement.recurrence_km).toBe(12000);
      expect(replacement.recurrence_months).toBe(24);
    }
  });

  it("does not copy the NH300 paper oil filter to NH190", () => {
    for (const year of [2025, 2026]) {
      expect(
        select("NH 190", year).items.some(
          (candidate) =>
            candidate.maintenance_type === "Filtro de óleo - papel",
        ),
      ).toBe(false);
      expect(
        item(select("NH 300", year), "Filtro de óleo - papel")
          .schedule_milestones,
      ).toEqual([
        { km: 1000, months: 6 },
        { km: 3000, months: 12 },
      ]);
    }
  });

  it("retains calendar-only and condition-dependent maintenance without inventing distance", () => {
    for (const entry of automatic) {
      const cooling = item(
        entry,
        "Mangueiras, líquido e vedações do arrefecimento",
      );
      expect(cooling.schedule_milestones).toEqual([{ km: null, months: 36 }]);
      expect(cooling.recurrence_km).toBeNull();
      expect(cooling.recurrence_months).toBe(36);
      expect(item(entry, "Corrente de transmissão").notes).toContain("chuva");
      expect(item(entry, "Pneus - pressão").interval_days).toBe(7);
      expect(
        entry.items.some(
          (candidate) => candidate.maintenance_type === "Fluido de freio",
        ),
      ).toBe(false);
    }
  });

  it("does not promote edition/copyright dates or contradictory source tables", () => {
    expect(select("NHX 190").is_exact_schedule).toBe(false);
    expect(select("Cruisym 150").is_exact_schedule).toBe(false);
    expect(select("Cruisym 150").coverage_notes).toContain("conflito");
    const shineray = entries.filter((entry) => entry.brand === "Shineray");
    expect(shineray).toHaveLength(4);
    for (const entry of shineray) {
      expect(entry.is_exact_schedule).toBe(false);
      expect(entry.coverage_notes).toContain("não comprovam");
      expect(
        entry.items.some((candidate) =>
          /Eixos/.test(candidate.maintenance_type),
        ),
      ).toBe(false);
    }
    expect(item(select("SHI 175S EFI", 2024), "Válvulas").interval_km).toBe(
      3000,
    );
    expect(item(select("Free 150 EFI", 2024), "Válvulas").interval_km).toBe(
      1000,
    );
  });

  it("separates the two officially listed BR 200Duke 2020 documents", () => {
    const variants = entries.filter(
      (entry) =>
        entry.brand === "KTM" &&
        entry.model === "200 Duke" &&
        entry.year_from === 2020,
    );
    expect(variants).toHaveLength(2);
    expect(new Set(variants.map((entry) => entry.model_id)).size).toBe(2);
    expect(variants.map((entry) => entry.variant)).toEqual([
      "BR F4140T2/T3",
      "BR F4140T5/T6/T7",
    ]);
    for (const entry of entries.filter(
      (candidate) => candidate.brand === "KTM",
    )) {
      expect(entry.is_exact_schedule).toBe(false);
      expect(entry.coverage_notes).toContain("eixo de tempo independente");
      expect(
        entry.items.every(
          (candidate) => candidate.schedule_milestones.length === 0,
        ),
      ).toBe(true);
      expect(entry.official_url).toMatch(
        /^https:\/\/azwecdnepstoragewebsiteuploads\.azureedge\.net\//,
      );
    }
    expect(item(select("390 Duke", 2022), "Quadro e balança").interval_km).toBe(
      30000,
    );
    expect(item(select("390 Duke", 2023), "Quadro e balança").interval_km).toBe(
      15000,
    );
  });

  it("keeps every transcribed item attributable and leaves owner plans untouched", () => {
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(entry.page_reference).toMatch(/p\. .*PDF p\./);
      expect(entry.document_version.length).toBeGreaterThan(10);
      expect(entry.items.length).toBeGreaterThan(10);
      expect(
        new Set(entry.items.map((candidate) => candidate.maintenance_type))
          .size,
      ).toBe(entry.items.length);
      for (const candidate of entry.items) {
        expect(
          candidate.interval_km !== null || candidate.interval_days !== null,
        ).toBe(true);
      }
    }
    expect(migration).toContain("date '2026-10-23'");
    expect(migration).toContain("returning id into manual_id");
    expect(migration).toContain(
      "on conflict (template_id, maintenance_type) do update",
    );
    expect(migration).not.toMatch(
      /(?:insert into|update|delete from) public\.maintenance_plan_items/i,
    );
    expect(migration).not.toMatch(
      /create policy|enable row level security|to authenticated/i,
    );
  });
});
