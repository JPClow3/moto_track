import { beforeEach, describe, expect, it } from "vitest";
import type { PublicSaleReport } from "../../src/lib/types/sale-report";

/**
 * Records every tagged-template query issued through the fake `Sql` so tests
 * can assert scoping (owner_id/motorcycle_id bound as interpolated values)
 * and column selection (the literal SQL text), the same things the old
 * Supabase-builder mock asserted via `.eq()`/`.select()` calls.
 */
type Call = { sql: string; values: unknown[] };

let calls: Call[] = [];
let resolveCall: (call: Call) => unknown;

function fakeSql() {
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const call: Call = { sql: strings.join(" "), values };
    calls.push(call);
    return Promise.resolve(resolveCall(call));
  };
  return tag as unknown as import("postgres").Sql;
}

const OWNER = "owner-uuid-1";
const MOTO = "moto-uuid-1";

// Deliberately fatter than the allow-list: if the mapping ever regresses to
// spreading the row, these values will surface in the output.
const motorcycleRow = {
  name: "Honda CB 500F",
  brand: "Honda",
  model: "CB 500F",
  year: 2021,
  current_odometer_km: 32418,
  previous_owners: 1,
  riding_profile: "urbano",
  deleted_at: null,
  owner_id: OWNER,
  license_plate: "ABC1D23",
  purchase_price_cents: 3500000,
  observations: "comprei baratinho do meu primo",
  photo_key: "private/photo.jpg",
};

const shareRow = {
  id: "share-1",
  owner_id: OWNER,
  motorcycle_id: MOTO,
  expires_at: "2030-01-01T00:00:00.000Z",
  access_count: 4,
  token_hash: "deadbeef".repeat(8),
};

function defaultResolver(call: Call) {
  const sql = call.sql;
  if (sql.includes("update sale_report_shares")) return [];
  if (sql.includes("from sale_report_shares")) return [shareRow];
  if (sql.includes("from motorcycles")) return [motorcycleRow];
  if (sql.includes("from fuel_records")) {
    return [{ total_price_cents: 10_000 }, { total_price_cents: 5_000 }];
  }
  if (sql.includes("from maintenance_records")) {
    if (sql.includes("order by date desc")) {
      return [
        {
          date: "2025-03-02",
          maintenance_type: "Troca de óleo",
          odometer_km: 30000,
          description: "Óleo e filtro",
          cost_cents: 20_000,
        },
      ];
    }
    return [{ cost_cents: 20_000 }, { cost_cents: 5_000 }];
  }
  if (sql.includes("from tire_records")) return [{ cost_cents: 80_000 }];
  if (sql.includes("from annual_fees")) return [{ amount_cents: 30_000 }];
  return [];
}

type LoadResult = { report: PublicSaleReport };

async function loadReport(token = "tok"): Promise<LoadResult> {
  const mod =
    await import("../../src/routes/(public)/reports/sale/public/[token]/+page.server");
  const load = mod.load as unknown as (event: {
    params: { token: string };
    locals: { db: unknown };
  }) => Promise<LoadResult>;
  return load({ params: { token }, locals: { db: fakeSql() } });
}

beforeEach(() => {
  calls = [];
  resolveCall = defaultResolver;
});

describe("public sale report loader", () => {
  it("sums each cost bucket and the overall total", async () => {
    const { report } = await loadReport();

    expect(report.totals.fuel).toBe(15_000);
    expect(report.totals.maintenance).toBe(25_000);
    expect(report.totals.tires).toBe(80_000);
    expect(report.totals.fees).toBe(30_000);
    expect(report.totals.all).toBe(150_000);
    expect(report.serviceCount).toBe(2);
  });

  it("never exposes the owner, the token hash, or seller-private fields", async () => {
    const data = await loadReport();
    const serialised = JSON.stringify(data);

    // This is what SvelteKit ships to the browser, so it is the real boundary.
    expect(serialised).not.toContain(OWNER);
    expect(serialised).not.toContain("deadbeef");
    expect(serialised).not.toContain("ABC1D23");
    expect(serialised).not.toContain("3500000");
    expect(serialised).not.toContain("baratinho");
    expect(serialised).not.toContain("private/photo.jpg");

    // ...while still carrying what a buyer came for.
    expect(serialised).toContain("Honda CB 500F");
    expect(data.report.motorcycle.odometerKm).toBe(32418);
  });

  it("asks Postgres only for named columns, never *", async () => {
    await loadReport();
    for (const call of calls) {
      expect(call.sql.toLowerCase()).not.toMatch(/select \*/);
    }
  });

  it("scopes every record query to the share's own owner and motorcycle", async () => {
    await loadReport();
    const recordTableMarkers = [
      "from motorcycles",
      "from fuel_records",
      "from maintenance_records",
      "from tire_records",
      "from annual_fees",
    ];
    const scoped = calls.filter((c) =>
      recordTableMarkers.some((marker) => c.sql.includes(marker)),
    );
    expect(scoped.length).toBeGreaterThan(0);
    for (const call of scoped) {
      expect(call.values).toContain(OWNER);
      expect(call.values).toContain(MOTO);
    }
  });

  it("only accepts a share that is unrevoked and unexpired", async () => {
    await loadReport();
    const share = calls.find(
      (c) =>
        c.sql.includes("from sale_report_shares") && !c.sql.includes("update"),
    )!;
    expect(share.sql).toContain("revoked_at is null");
    expect(share.sql).toContain("expires_at >= now()");
  });

  it("404s on an unknown or expired token", async () => {
    resolveCall = (call) =>
      call.sql.includes("from sale_report_shares") &&
      !call.sql.includes("update")
        ? []
        : defaultResolver(call);
    await expect(loadReport("nope")).rejects.toMatchObject({ status: 404 });
  });

  it("404s when the shared motorcycle has been deleted", async () => {
    resolveCall = (call) =>
      call.sql.includes("from motorcycles")
        ? [{ ...motorcycleRow, deleted_at: "2025-01-01" }]
        : defaultResolver(call);
    await expect(loadReport()).rejects.toMatchObject({ status: 404 });
  });

  it("records the visit against the share", async () => {
    await loadReport();
    const update = calls.find((c) =>
      c.sql.includes("update sale_report_shares"),
    );
    expect(update).toBeDefined();
    expect(update?.values).toContain(5);
  });
});
