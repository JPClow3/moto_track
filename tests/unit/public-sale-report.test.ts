import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSaleReport } from "../../src/lib/types/sale-report";

/**
 * Chainable stand-in for the Supabase query builder. Records what each call
 * asked for so the tests can assert scoping, and is thenable so `await`ing a
 * builder without .maybeSingle() resolves like the real client.
 */
type Call = {
  table: string;
  columns?: string;
  filters: Array<[string, string, unknown]>;
  update?: Record<string, unknown>;
  limit?: number;
};

let calls: Call[] = [];
let resolve: (call: Call) => { data: unknown };

function builder(call: Call) {
  const b: Record<string, unknown> = {
    select(columns: string) {
      call.columns = columns;
      return b;
    },
    update(patch: Record<string, unknown>) {
      call.update = patch;
      return b;
    },
    eq(k: string, v: unknown) {
      call.filters.push(["eq", k, v]);
      return b;
    },
    is(k: string, v: unknown) {
      call.filters.push(["is", k, v]);
      return b;
    },
    gte(k: string, v: unknown) {
      call.filters.push(["gte", k, v]);
      return b;
    },
    order() {
      return b;
    },
    limit(n: number) {
      call.limit = n;
      return b;
    },
    maybeSingle: async () => resolve(call),
    then: (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) =>
      Promise.resolve(resolve(call)).then(ok, err),
  };
  return b;
}

vi.mock("$server/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      const call: Call = { table, filters: [] };
      calls.push(call);
      return builder(call);
    },
  }),
}));

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
  motorcycles: motorcycleRow,
};

function defaultResolver(call: Call) {
  if (call.table === "sale_report_shares") return { data: shareRow };
  if (call.table === "fuel_records")
    return {
      data: [{ total_price_cents: 10_000 }, { total_price_cents: 5_000 }],
    };
  if (call.table === "maintenance_records") {
    if (call.limit) {
      return {
        data: [
          {
            date: "2025-03-02",
            maintenance_type: "Troca de óleo",
            odometer_km: 30000,
            description: "Óleo e filtro",
            cost_cents: 20_000,
          },
        ],
      };
    }
    return { data: [{ cost_cents: 20_000 }, { cost_cents: 5_000 }] };
  }
  if (call.table === "tire_records") return { data: [{ cost_cents: 80_000 }] };
  if (call.table === "annual_fees") return { data: [{ amount_cents: 30_000 }] };
  return { data: null };
}

type LoadResult = { report: PublicSaleReport };

async function loadReport(token = "tok"): Promise<LoadResult> {
  vi.resetModules();
  const mod =
    await import("../../src/routes/(public)/reports/sale/public/[token]/+page.server");
  const load = mod.load as unknown as (event: {
    params: { token: string };
    platform: undefined;
  }) => Promise<LoadResult>;
  return load({ params: { token }, platform: undefined });
}

beforeEach(() => {
  calls = [];
  resolve = defaultResolver;
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
      if (call.columns) expect(call.columns).not.toContain("*");
    }
  });

  it("scopes every record query to the share's own owner and motorcycle", async () => {
    await loadReport();
    const recordTables = [
      "fuel_records",
      "maintenance_records",
      "tire_records",
      "annual_fees",
    ];
    const scoped = calls.filter((c) => recordTables.includes(c.table));
    expect(scoped.length).toBeGreaterThan(0);
    for (const call of scoped) {
      expect(call.filters).toContainEqual(["eq", "owner_id", OWNER]);
      expect(call.filters).toContainEqual(["eq", "motorcycle_id", MOTO]);
    }
  });

  it("only accepts a share that is unrevoked and unexpired", async () => {
    await loadReport();
    const share = calls.find((c) => c.table === "sale_report_shares")!;
    expect(share.filters).toContainEqual(["is", "revoked_at", null]);
    expect(
      share.filters.some(([op, key]) => op === "gte" && key === "expires_at"),
    ).toBe(true);
  });

  it("404s on an unknown or expired token", async () => {
    resolve = (call) =>
      call.table === "sale_report_shares"
        ? { data: null }
        : defaultResolver(call);
    await expect(loadReport("nope")).rejects.toMatchObject({ status: 404 });
  });

  it("404s when the shared motorcycle has been deleted", async () => {
    resolve = (call) =>
      call.table === "sale_report_shares"
        ? {
            data: {
              ...shareRow,
              motorcycles: { ...motorcycleRow, deleted_at: "2025-01-01" },
            },
          }
        : defaultResolver(call);
    await expect(loadReport()).rejects.toMatchObject({ status: 404 });
  });

  it("records the visit against the share", async () => {
    await loadReport();
    const update = calls.find((c) => c.update);
    expect(update?.table).toBe("sale_report_shares");
    expect(update?.update?.access_count).toBe(5);
  });
});
