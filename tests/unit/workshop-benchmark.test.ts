import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";
import {
  safeWorkshopSummary,
  saveWorkshopContribution,
  validateWorkshopContribution,
  withdrawWorkshopContribution,
  workshopIdentity,
  workshopRecordEligible,
  workshopRegion,
  type WorkshopContributionInput,
  type WorkshopRecord,
} from "../../src/lib/server/domain/workshop-benchmark";
import { workshopMessages } from "../../src/lib/i18n/workshop-comparison";

const record: WorkshopRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  workshop: "  Oficina São João  ",
  maintenance_type: "Troca de óleo",
  date: "2026-01-02",
  cost_cents: 20_000,
  currency: "BRL",
};
const input: WorkshopContributionInput = {
  recordId: record.id,
  laborAmount: "50,25",
  city: " São José dos Campos ",
  state: "sp",
  consent: true,
};

describe("workshop contribution validation", () => {
  it("normalizes identities and accepts an explicitly confirmed labor split", () => {
    expect(workshopIdentity(" Oficina SÃO João! ")).toBe("oficina-sao-joao");
    expect(workshopIdentity("  OFICINA São João ")).toBe("oficina-sao-joao");
    expect(validateWorkshopContribution(input, record, "2026-10-23")).toEqual({
      workshopKey: "oficina-sao-joao",
      workshopName: "Oficina São João",
      serviceKey: "troca-de-oleo",
      cityName: "São José dos Campos",
      cityKey: "sao-jose-dos-campos",
      stateCode: "SP",
      laborCents: 5025,
      servicedOn: "2026-01-02",
    });
  });

  it("requires consent and the exact owned source, without inferring labor", () => {
    expect(() =>
      validateWorkshopContribution({ ...input, consent: false }, record),
    ).toThrow("consentRequired");
    expect(() =>
      validateWorkshopContribution(
        { ...input, recordId: crypto.randomUUID() },
        record,
      ),
    ).toThrow("invalidRecord");
    expect(() =>
      validateWorkshopContribution({ ...input, laborAmount: "" }, record),
    ).toThrow("invalidLabor");
    expect(() =>
      validateWorkshopContribution({ ...input, laborAmount: "200.01" }, record),
    ).toThrow("laborExceedsTotal");
    expect(
      validateWorkshopContribution({ ...input, laborAmount: "200" }, record)
        .laborCents,
    ).toBe(20000);
  });

  it.each([
    "0",
    "-10",
    "1e2",
    "20.001",
    "NaN",
    "Infinity",
    "10abc",
    "10.000,00",
    "10000.01",
  ])("rejects invalid or implausible labor amount %s", (laborAmount) =>
    expect(() =>
      validateWorkshopContribution({ ...input, laborAmount }, record),
    ).toThrow("invalidLabor"),
  );

  it.each([
    { workshop: "" },
    { maintenance_type: "" },
    { maintenance_type: "other" },
    { maintenance_type: "Outro" },
    { currency: "USD" },
    { cost_cents: 0 },
    { cost_cents: Number.NaN },
    { date: "2026-02-30" },
    { date: "2027-01-01" },
  ])(
    "rejects sources without a specific workshop/service, valid date or BRL total: %j",
    (change) => {
      expect(
        workshopRecordEligible({ ...record, ...change }, "2026-10-23"),
      ).toBe(false);
    },
  );

  it("accepts a PostgreSQL Date and rejects incomplete region identities", () => {
    expect(
      workshopRecordEligible(
        { ...record, date: new Date("2026-01-02T00:00:00Z") },
        "2026-10-23",
      ),
    ).toBe(true);
    for (const [city, state] of [
      ["", "SP"],
      ["123", "SP"],
      ["Santos", "XX"],
      ["🏍️", "SP"],
      ["x".repeat(121), "SP"],
    ]) {
      expect(workshopRegion(city, state)).toBeNull();
      expect(() =>
        validateWorkshopContribution({ ...input, city, state }, record),
      ).toThrow("invalidRegion");
    }
  });
});

function mockSql(source: WorkshopRecord[] = [record]) {
  const query = vi.fn(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      if (text.includes('from neon_auth."user"')) return [{ id: values[0] }];
      if (text.includes("from maintenance_records")) return source;
      if (text.includes("insert into workshop_benchmark_submission_guards")) {
        return [{ contribution_id: "00000000-0000-4000-8000-000000000002" }];
      }
      return [];
    },
  );
  const db = Object.assign(query, {
    begin: vi.fn(async (callback) => callback(query)),
  });
  return { db: db as unknown as Sql, query, begin: db.begin };
}

describe("workshop contribution authorization and lifecycle", () => {
  it("refuses a foreign or missing record before any anonymous contribution write", async () => {
    const { db, query } = mockSql([]);
    await expect(
      saveWorkshopContribution(db, "signed-in-account", input),
    ).rejects.toMatchObject({ code: "invalidRecord", status: 404 });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0].join("?")).toContain("owner_id = ?");
    expect(query.mock.calls[1]).toContain("signed-in-account");
  });

  it("requires explicit consent before consulting or writing the database", async () => {
    const { db, begin } = mockSql();
    await expect(
      saveWorkshopContribution(db, "account", { ...input, consent: false }),
    ).rejects.toMatchObject({ code: "consentRequired" });
    expect(begin).not.toHaveBeenCalled();
  });

  it("deduplicates an owned record and sources workshop/service values only from the locked database row", async () => {
    const { db, query } = mockSql();
    await saveWorkshopContribution(db, "signed-in-account", {
      ...input,
      workshop: "Spoofed",
    } as WorkshopContributionInput);
    // The owner lock precedes the record lock, matching account deletion.
    expect(query.mock.calls[0][0].join("?")).toContain("for no key update");
    expect(query.mock.calls[0]).toContain("signed-in-account");
    expect(query.mock.calls[1][0].join("?")).toContain("for update");
    const guard = query.mock.calls[2];
    expect(guard[0].join("?")).toContain("on conflict (owner_id, record_id)");
    expect(guard).toContain(record.workshop);
    expect(guard).toContain(record.maintenance_type);
    expect(guard).toContain("signed-in-account");
    const contribution = query.mock.calls[3];
    expect(contribution[0].join("?")).toContain("on conflict (id)");
    expect(contribution).toContain(5025);
    expect(contribution).not.toContain("signed-in-account");
    expect(contribution).not.toContain("Spoofed");
  });

  it("withdraws through an owner-scoped guard and rejects malformed IDs", async () => {
    const { db, query } = mockSql();
    await withdrawWorkshopContribution(db, "signed-in-account", record.id);
    expect(query.mock.calls[0][0].join("?")).toContain(
      "where owner_id = ? and record_id = ?",
    );
    expect(query.mock.calls[0]).toContain("signed-in-account");
    expect(query.mock.calls[0]).toContain(record.id);
    await expect(
      withdrawWorkshopContribution(db, "account", "bad-id"),
    ).rejects.toMatchObject({ code: "invalidRecord" });
    expect(query).toHaveBeenCalledOnce();
  });
});

describe("workshop aggregate privacy", () => {
  it("withholds under-five or malformed metrics even if SQL erroneously returns them", () => {
    for (const sample_size of [0, 1, 4, -5, 5.5, "not-a-number"]) {
      expect(
        safeWorkshopSummary({
          workshop_name: "Oficina",
          sample_size,
          average_labor_cents: 5000,
        }),
      ).toBeNull();
    }
    for (const average_labor_cents of [
      null,
      0,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      1_000_001,
    ]) {
      expect(
        safeWorkshopSummary({
          workshop_name: "Oficina",
          sample_size: 5,
          average_labor_cents,
        }),
      ).toBeNull();
    }
  });

  it("exposes only safe aggregate fields when five distinct accounts qualify", () => {
    expect(
      safeWorkshopSummary({
        workshop_name: " Oficina ",
        sample_size: "5",
        average_labor_cents: "5050",
        owner_id: "secret",
        labor_cents: 123,
        record_id: "private",
      }),
    ).toEqual({ workshop: "Oficina", accounts: 5, averageLaborCents: 5050 });
  });

  it("provides complete Portuguese and English states including consent and insufficient data", () => {
    const portuguese = workshopMessages("pt-BR");
    const english = workshopMessages("en");
    expect(Object.keys(english).sort()).toEqual(Object.keys(portuguese).sort());
    expect(english.insufficient).toContain("five distinct accounts");
    expect(portuguese.privacy).toContain("cinco contas diferentes");
    expect(english.consent).toContain("withdraw");
  });
});
