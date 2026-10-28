import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "svelte/server";
import { readable } from "svelte/store";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  createTranslator,
  formatDate,
  formatDistance,
  formatMoney,
  formatNumber,
  formatPreciseMoney,
} from "../../src/lib/i18n/index";

vi.mock("$lib/i18n/store", () => ({
  locale: readable("pt-BR"),
  t: readable(createTranslator("pt-BR")),
  format: readable({
    money: (cents: number) => formatMoney("pt-BR", cents),
    preciseMoney: (millicents: number) =>
      formatPreciseMoney("pt-BR", millicents),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber("pt-BR", value, options),
    distance: (km: number) => formatDistance("pt-BR", km),
    date: (
      value: string | number | Date,
      options?: Intl.DateTimeFormatOptions,
    ) => formatDate("pt-BR", value, options),
  }),
}));

const pt = createTranslator("pt-BR");
const bike = {
  id: "m1",
  name: "CB 500F",
  brand: "Honda",
  model: "CB 500F",
  current_odometer_km: 12500,
};
const count = (body: string, text: string) => body.split(text).length - 1;

beforeAll(async () => {
  await Promise.all([
    import("../../src/routes/(app)/maintenance/+page.svelte"),
    import("../../src/routes/(app)/tires/+page.svelte"),
  ]);
}, 60_000);

describe("service pages UX", () => {
  it("renders one tire empty state without the metric strip", async () => {
    const module = await import("../../src/routes/(app)/tires/+page.svelte");
    const { body } = render(module.default, {
      props: {
        data: {
          errorMessage: "",
          rows: [],
          activeTires: [],
          motorcycles: [bike],
          activeMotorcycleId: "m1",
          products: [],
          pressures: [],
        } as never,
        form: null,
      },
    });
    expect(body).toContain(pt("serviceUx.tiresEmptyTitle"));
    expect(count(body, pt("tires.activeEmptyHint"))).toBe(1);
    expect(body).not.toContain("signal-strip");
    expect(body).toContain(pt("tires.installAction"));
  }, 15_000);

  it("marks worn tires as overdue and healthy ones as ok", async () => {
    const module = await import("../../src/routes/(app)/tires/+page.svelte");
    const tire = (id: string, position: string, wear: number) => ({
      id,
      installed_at: "2026-06-01",
      position,
      brand_model: `Pneu ${id}`,
      motorcycle_id: "m1",
      motorcycle_name: "CB 500F",
      wear_percent: wear,
      cost_cents: 14990,
      installed_odometer_km: 8000,
      is_active: true,
      current_km: 12500,
      life_estimate: null,
    });
    const tires = [tire("a", "dianteiro", 85), tire("b", "traseiro", 20)];
    const { body } = render(module.default, {
      props: {
        data: {
          errorMessage: "",
          rows: tires,
          activeTires: tires,
          motorcycles: [bike],
          products: [],
          pressures: [],
        } as never,
        form: null,
      },
    });
    expect(body).toContain('data-tone="overdue"');
    expect(body).toContain('data-tone="ok"');
    expect(body).toContain(pt("serviceUx.tireActiveOther", { count: 2 }));
    expect(body).toContain('class="data-table');
    expect(body).toContain('inputmode="decimal"');
  }, 15_000);

  it("replaces the maintenance layout with one empty state", async () => {
    const module =
      await import("../../src/routes/(app)/maintenance/+page.svelte");
    const { body } = render(module.default, {
      props: {
        data: {
          errorMessage: "",
          rows: [],
          motorcycles: [bike],
          parts: [],
          plans: [],
          photos: [],
        } as never,
        form: null,
      },
    });
    expect(body).toContain(pt("serviceUx.maintenanceEmptyTitle"));
    expect(count(body, pt("maintenance.emptyRecordsHint"))).toBe(1);
    expect(body).not.toContain("signal-strip");
    expect(body).toContain(pt("serviceUx.logService"));
  }, 15_000);

  it("keeps service pages on the design-system rules", () => {
    for (const path of [
      "src/routes/(app)/maintenance/+page.svelte",
      "src/routes/(app)/maintenance/workshops/+page.svelte",
      "src/routes/(app)/tires/+page.svelte",
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source, path).not.toMatch(/text-\[(?:9|10|11)px\]/);
      expect(source, path).not.toMatch(/eyebrow=|circle-gauge|icons\/bike"/);
      expect(source, path).not.toMatch(/bg-danger\/|text-brand|uppercase/);
      expect(source, path).not.toMatch(/step="?\.?0?\.01"?/);
    }
  });
});
