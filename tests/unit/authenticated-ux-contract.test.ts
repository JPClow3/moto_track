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

vi.mock("$app/stores", () => ({
  page: readable({
    data: { locale: "pt-BR" },
    url: new URL("http://localhost/fuel"),
  }),
  navigating: readable(null),
  updated: readable(false),
}));

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

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

// These assertions measure the rendered contracts. Compile the large page
// modules once with a separate startup budget, before their render assertions.
beforeAll(async () => {
  await Promise.all([
    import("../../src/routes/(app)/fuel/+page.svelte"),
    import("../../src/routes/(app)/maintenance/+page.svelte"),
    import("../../src/routes/(app)/tires/+page.svelte"),
    import("../../src/routes/(app)/dashboard/+page.svelte"),
  ]);
}, 60_000);

describe("authenticated UX primitives contract", () => {
  it("renders a labelled native record dialog with close button and title", async () => {
    const module =
      await import("../../src/lib/components/app/RecordSheet.svelte").catch(
        () => null,
      );
    expect(module, "RecordSheet component must exist").not.toBeNull();
    const { body } = render(module!.default, {
      props: { title: "Novo abastecimento", closeLabel: "Fechar" },
    });
    expect(body).toContain("<dialog");
    expect(body).toContain("Novo abastecimento");
    expect(body).toContain('aria-label="Fechar"');
  });

  it("renders one explicitly labelled primary action", async () => {
    const module =
      await import("../../src/lib/components/app/PageAction.svelte").catch(
        () => null,
      );
    expect(module, "PageAction component must exist").not.toBeNull();
    const { body } = render(module!.default, {
      props: {
        label: "Adicionar abastecimento",
        ariaLabel: "Adicionar abastecimento",
      },
    });
    expect(body.match(/<button/g)).toHaveLength(1);
    expect(body).toContain('aria-label="Adicionar abastecimento"');
  });

  it("renders up to 3 signals", async () => {
    const module =
      await import("../../src/lib/components/app/SignalStrip.svelte").catch(
        () => null,
      );
    expect(module, "SignalStrip component must exist").not.toBeNull();
    const { body } = render(module!.default, {
      props: {
        signals: [
          { label: "Gasto no mês", value: "R$ 150,00" },
          { label: "Consumo médio", value: "35,2 km/l" },
          { label: "Desde o último", value: "280 km" },
          { label: "Sinal extra", value: "Não deve aparecer" },
        ],
      },
    });
    expect(body).toContain("Gasto no mês");
    expect(body).toContain("Consumo médio");
    expect(body).toContain("Desde o último");
    expect(body).not.toContain("Sinal extra");
  });

  it("renders ActionMenu choices", async () => {
    const module =
      await import("../../src/lib/components/app/ActionMenu.svelte").catch(
        () => null,
      );
    expect(module, "ActionMenu component must exist").not.toBeNull();
    const { body } = render(module!.default, {
      props: {
        title: "Opções de abastecimento",
        choices: [
          {
            id: "scan",
            label: "Escanear comprovante",
            description: "Foto ou cupom",
            recommended: true,
          },
          {
            id: "manual",
            label: "Digitar manualmente",
            description: "Preencher campos",
          },
        ],
      },
    });
    expect(body).toContain("<dialog");
    expect(body).toContain("Escanear comprovante");
    expect(body).toContain("Foto ou cupom");
    expect(body).toContain("Digitar manualmente");
    expect(body).toContain("h-11 w-11");
    expect(body).toContain("min-h-11 w-full");
  });

  it("keeps explicit authenticated-page controls at least 44px tall", () => {
    const controlledSurfaces = [
      "src/routes/(app)/dashboard/+page.svelte",
      "src/routes/(app)/garage/+page.svelte",
      "src/routes/(app)/expenses/+page.svelte",
      "src/routes/(app)/reports/+page.svelte",
      "src/routes/(app)/tires/+page.svelte",
      "src/lib/components/app/ActionMenu.svelte",
    ];

    for (const path of controlledSurfaces) {
      const contents = source(path);
      expect(
        contents,
        `${path} must not shrink controls below 44px`,
      ).not.toMatch(/min-h-(?:8|9)\b/);
    }
  });

  it("gives Fuel one add action that opens one short form with scan and repeat shortcuts", async () => {
    const module =
      await import("../../src/routes/(app)/fuel/+page.svelte").catch(
        () => null,
      );
    expect(module, "Fuel page component must exist").not.toBeNull();

    const mockData = {
      errorMessage: "",
      rows: [
        {
          id: "r1",
          date: "2026-07-10",
          odometer_km: 12000,
          liters: 10,
          total_price_cents: 6500,
          price_per_liter_millicents: 650000,
          station_name: "Posto Shell",
          motorcycle_id: "m1",
          tank_full: true,
          receipt_file_key: null,
        },
      ],
      motorcycles: [{ id: "m1", name: "CB 500F", current_odometer_km: 12500 }],
      stations: [{ id: "s1", name: "Posto Shell" }],
      grades: [{ id: "g1", name: "Gasolina Comum" }],
      preferences: [
        {
          motorcycle_id: "m1",
          station_id: "s1",
          fuel_grade_id: "g1",
          fuel_type: "gasoline",
          price_per_liter_millicents: 650000,
          tank_full: true,
        },
      ],
      reviewPreferences: [],
      consumption: [
        { date: "2026-07-01", value: 30 },
        { date: "2026-07-10", value: 32 },
      ],
      summary: {
        totalSpend: 6500,
        totalLiters: 10,
        averageConsumption: 32,
        costPerKm: 0.25,
        lastRecord: null,
      },
    };

    const { body } = render(module!.default, {
      props: { data: mockData as never, form: null },
    });

    expect(body).toContain("<dialog");
    // Scan and repeat are shortcuts inside the one form, not a chooser.
    expect(body).toContain("Escanear comprovante");
    expect(body).toContain("Repetir último");
    expect(body).not.toContain("Digitar manualmente");
    expect(body).toContain("page-action");
    // Odometer, litres and total up front; the rest behind one disclosure,
    // and one station field instead of a saved/free-text pair.
    expect(body).toContain('id="fuel-new-odometer"');
    expect(body).toContain('id="fuel-new-liters"');
    expect(body).toContain('id="fuel-new-total-price"');
    expect(body).toContain("Mais detalhes");
    expect(body).not.toContain("Posto cadastrado");
    expect(body).not.toContain('name="price_per_liter"');
    // Save stays pinned in the sheet; rows edit instead of deleting inline.
    expect(body).toContain("sheet-actions");
    expect(body).not.toContain('action="?/deleteRecord"');
    const fuelSrc = source("src/routes/(app)/fuel/+page.svelte");
    expect(fuelSrc).toContain('action="?/updateRecord"');
    expect(fuelSrc).not.toContain('action="?/repeatLast"');
  }, 15_000);

  it("never throws on a fill-up date that is not YYYY-MM-DD", async () => {
    // postgres.js returns `date` as a Date; the loader normalizes it, and the
    // fields must still render if a stringified Date slips through.
    const module =
      await import("../../src/lib/components/FuelRecordFields.svelte");
    const { body } = render(module.default, {
      props: {
        idPrefix: "fuel-edit",
        motorcycles: [{ id: "m1", name: "CB 500F" }],
        initial: { motorcycle_id: "m1", date: "Sat Oct 31 2026" },
      },
    });
    expect(body).toContain("CB 500F");
    const fuelServer = source("src/routes/(app)/fuel/+page.server.ts");
    expect(fuelServer).toContain("date: isoDateValue(row.date)");
  });

  it("keeps an unassigned fill-up unassigned in the editor", async () => {
    const module =
      await import("../../src/lib/components/FuelRecordFields.svelte");
    const { body } = render(module.default, {
      props: {
        idPrefix: "fuel-edit",
        motorcycles: [{ id: "m1", name: "CB 500F" }],
        initial: { motorcycle_id: "", date: "2026-10-01" },
        allowUnassigned: true,
      },
    });
    expect(body).toContain("Sem moto");
    expect(body).toMatch(/<option value=""[^>]*selected/);
    expect(source("src/routes/(app)/dashboard/+page.server.ts")).toContain(
      'bikeHref("/fuel", row.motorcycle_id)',
    );
  });

  it("keeps an archived bike's fill-up linked to it in the editor", async () => {
    const module =
      await import("../../src/lib/components/FuelRecordFields.svelte");
    const { body } = render(module.default, {
      props: {
        idPrefix: "fuel-edit",
        motorcycles: [{ id: "m1", name: "CB 500F" }],
        initial: { motorcycle_id: "archived-1", date: "2026-10-01" },
        allowUnassigned: true,
      },
    });
    expect(body).toContain("Moto arquivada");
    expect(body).toMatch(/<option value="archived-1"[^>]*selected/);
  });

  it("gives Maintenance one add action and a primary 'Já fiz' on each plan card", async () => {
    const module =
      await import("../../src/routes/(app)/maintenance/+page.svelte");

    const mockData = {
      errorMessage: "",
      rows: [
        {
          id: "m-rec-1",
          date: "2026-08-01",
          motorcycle_id: "m1",
          motorcycle_name: "CB 500F",
          maintenance_type: "Troca de óleo",
          odometer_km: 10000,
          cost_cents: 12000,
          workshop: "Oficina Central",
          description: "Óleo e filtro trocados",
        },
      ],
      motorcycles: [
        {
          id: "m1",
          name: "CB 500F",
          brand: "Honda",
          model: "CB 500F",
          current_odometer_km: 12500,
        },
      ],
      parts: [],
      plans: [
        {
          id: "p1",
          motorcycle_id: "m1",
          motorcycle_name: "CB 500F",
          maintenance_type: "Troca de óleo",
          interval_km: 5000,
          interval_days: 180,
          last_done_km: 10000,
          urgency: "scheduled",
          due_km: 15000,
          remaining_km: 2500,
          progress_percent: 50,
          current_km: 12500,
        },
      ],
      photos: [],
    };

    const { body } = render(module!.default, {
      props: { data: mockData as never, form: null },
    });

    expect(body).toContain("page-header");
    // The shell's switcher is the only bike context.
    expect(body).not.toContain("bike-context-bar");
    expect(body).toContain("signal-strip");
    expect(body).toContain("page-action");
    expect(body).toContain("<dialog");
    expect(body).toContain("Registrar serviço realizado");
    expect(body).toContain("Agendar manutenção");
    expect(body).toContain("Já fiz");
    // History correction is a sheet behind the card's menu, not inline.
    expect(body).not.toContain("history-p1-status");
    expect(body).not.toContain('id="new-plan-details"');
    expect(body).not.toContain('id="marketplace-details"');
  }, 15000);

  it("gives Tires one add action and two entry paths in sheets without permanent forms", async () => {
    const module = await import("../../src/routes/(app)/tires/+page.svelte");

    const mockData = {
      errorMessage: "",
      rows: [
        {
          id: "t-rec-1",
          installed_at: "2026-06-01",
          position: "dianteiro",
          brand_model: "Michelin Road 5",
          motorcycle_id: "m1",
          motorcycle_name: "CB 500F",
          wear_percent: 30,
          cost_cents: 60000,
          installed_odometer_km: 8000,
          is_active: true,
        },
      ],
      motorcycles: [
        {
          id: "m1",
          name: "CB 500F",
          brand: "Honda",
          model: "CB 500F",
          current_odometer_km: 12500,
        },
      ],
      activeTires: [
        {
          id: "t-rec-1",
          installed_at: "2026-06-01",
          position: "dianteiro",
          brand_model: "Michelin Road 5",
          motorcycle_id: "m1",
          motorcycle_name: "CB 500F",
          wear_percent: 30,
          cost_cents: 60000,
          installed_odometer_km: 8000,
          is_active: true,
          current_km: 12500,
          life_estimate: { projectedChangeKm: 20000, remainingKm: 7500 },
        },
      ],
      pressures: [
        {
          id: "pr-1",
          motorcycle_id: "m1",
          date: "2026-08-15",
          psi_front: 36,
          psi_rear: 42,
          notes: "",
        },
      ],
      products: [],
    };

    const { body } = render(module!.default, {
      props: { data: mockData as never, form: null },
    });

    expect(body).toContain("page-header");
    expect(body).not.toContain("bike-context-bar");
    expect(body).toContain("signal-strip");
    expect(body).toContain("page-action");
    expect(body).toContain("<dialog");
    expect(body).toContain("Aferir calibragem");
    expect(body).toContain("Instalar ou trocar pneu");
    expect(body).not.toContain('id="tire-install-motorcycle"');
    expect(body).not.toContain('id="tire-pressure-motorcycle"');
  }, 15000);

  it("keeps the bike home short: compact hero, what is due, one cost metric", async () => {
    const module =
      await import("../../src/routes/(app)/dashboard/+page.svelte");

    const mockData = {
      today: "2026-08-15",
      metrics: [
        { label: "Motos", value: "1", detail: "Ativa" },
        { label: "Odômetro", value: "12.500 km", detail: "CB 500F" },
        { label: "Consumo", value: "32 km/L", detail: "Média" },
        { label: "Custo por km", value: "R$ 0,35", detail: "Geral" },
      ],
      garage: [
        {
          id: "m1",
          name: "CB 500F",
          detail: "Honda CB 500F · 2022",
          odometer: 12500,
          health: { total: 85, status: "ready" },
        },
      ],
      health: { total: 85, status: "ready" },
      healthMotorcycle: null,
      consumption: [{ date: "2026-08-01", value: 32 }],
      spend: [{ month: "2026-08", cents: 15000 }],
      costs: [{ key: "fuel", cents: 8000 }],
      activity: [{ date: "2026-08-15", count: 1 }],
      upcoming: [],
      dueNow: [],
      counts: { reminders: 0, tires: 0, documents: 0 },
      benchmark: null,
      recentActivity: [
        {
          id: "fuel-1",
          type: "fuel",
          date: "2026-08-15",
          title: "12L Gasolina",
          subtitle: "12.500 km",
          amountCents: 7000,
          href: "/fuel",
        },
      ],
      errorMessage: "",
    };

    const { body } = render(module.default, {
      props: { data: mockData as never },
    });

    expect(body).toContain("page-header");
    expect(body).toContain("bike-hero");
    expect(body).toContain("Tudo em dia");
    expect(body).toContain('href="/reports"');
    // Adding is the shell's +; analysis lives on /reports.
    expect(body).not.toContain("page-action");
    expect(body).not.toContain("<dialog");
    expect(body).not.toContain('href="/fuel?new=1"');
    expect(body).not.toContain("activity-timeline");
    expect(body).not.toContain("contributeBenchmark");
  }, 15000);

  it("rebuilds Garage with RecordSheet and no permanent creation rail", async () => {
    const garageSrc = source("src/routes/(app)/garage/+page.svelte");
    expect(garageSrc).toContain("RecordSheet");
    expect(garageSrc).toContain("PageHeader");
    expect(garageSrc).not.toContain("1fr_340px");
    expect(garageSrc).not.toContain('id="garage-new-bike"');

    const module = await import("../../src/routes/(app)/garage/+page.svelte");
    const mockData = {
      motorcycles: [
        {
          id: "m1",
          name: "CB 500F",
          brand: "Honda",
          model: "CB 500F",
          year: 2022,
          current_odometer_km: 12500,
          is_active: true,
        },
      ],
      models: [],
      canAddActive: true,
      errorMessage: "",
    };

    const { body } = render(module.default, {
      props: { data: mockData as never, form: null },
    });

    expect(body).toContain("page-header");
    expect(body).toContain("page-action");
    expect(body).toContain("<dialog");
  }, 15000);

  it("defines 3 entry paths in Expenses and moves forms into RecordSheets", async () => {
    const expensesSrc = source("src/routes/(app)/expenses/+page.svelte");
    expect(expensesSrc).toContain("expense-record");
    expect(expensesSrc).toContain("expense-policy");
    expect(expensesSrc).toContain("expense-claim");
    expect(expensesSrc).toContain("RecordSheet");
    // No permanent creation panels on the page
    expect(expensesSrc).not.toContain('class="panel grid gap-2 p-5"');

    const module = await import("../../src/routes/(app)/expenses/+page.svelte");
    const mockData = {
      feature: {
        slug: "expenses",
        title: "Despesas",
        subtitle: "Controle de despesas",
        tableName: "annual_fees",
        primaryKey: "id",
        ownerColumn: "owner_id",
        searchColumns: ["fee_type"],
        listColumns: ["fee_type", "amount_cents", "due_date"],
        fields: [],
      },
      rows: [],
      motorcycles: [],
      policies: [],
      claims: [],
      errorMessage: "",
    };

    const { body } = render(module.default, {
      props: { data: mockData as never, form: null },
    });

    expect(body).toContain("<dialog");
  }, 15000);

  it("loads reminder snooze fields for dashboard health scoring", () => {
    const dashboardSrc = source("src/routes/(app)/dashboard/+page.server.ts");
    expect(dashboardSrc).toContain("snoozed_until_date");
    expect(dashboardSrc).toContain("snoozed_until_km");
  });

  it("rebuilds Reports with PageHeader, generate report action, and no PageAction import", async () => {
    const reportsSrc = source("src/routes/(app)/reports/+page.svelte");
    expect(reportsSrc).toContain("PageHeader");
    expect(reportsSrc).toContain("RecordSheet");
    expect(reportsSrc).not.toContain("PageAction");

    const module = await import("../../src/routes/(app)/reports/+page.svelte");
    const mockData = {
      motorcycles: [
        {
          id: "m1",
          name: "CB 500F",
          brand: "Honda",
          model: "CB 500F",
          year: 2022,
        },
      ],
      shares: [],
      timeline: [],
      filters: { source: "", start: "", end: "" },
    };

    const { body } = render(module.default, {
      props: { data: mockData as never, form: null },
    });

    expect(body).toContain("page-header");
    expect(body).toContain("Gerar relatório");
    expect(body).not.toContain("page-action");
    expect(body).toContain("Exportar dados");
  }, 15000);

  it.each(["fuel", "maintenance", "tires"])(
    "follows the shell's active bike on /%s with no page-level bike selector",
    (route) => {
      // SvelteKit reuses the page component across shell bike switches, so
      // the bike context must be derived reactively, never initialised once
      // or overridden by a second selector on the page.
      const pageSrc = source(`src/routes/(app)/${route}/+page.svelte`);
      expect(pageSrc).toMatch(/\$: \w+ = String\(\s*data\.activeMotorcycleId/);
      expect(pageSrc).not.toContain("BikeContextBar");
      expect(pageSrc).not.toContain("bind:value={selectedMotorcycleId}");
    },
  );
});
