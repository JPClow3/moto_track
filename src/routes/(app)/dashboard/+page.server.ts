import { fail, redirect, type Actions } from "@sveltejs/kit";
import { dashboardSummary, healthScore } from "$server/domain/reports";
import { evaluateReminder, type ReminderInput } from "$server/domain/reminders";
import {
  activityCalendar,
  consumptionTrend,
  costBreakdown,
  spendByMonth,
} from "$server/domain/dashboard";
import {
  formatDistance,
  formatMoney,
  formatNumber,
  translate,
  type MessageKey,
} from "$lib/i18n";
import {
  dueStateForPlan,
  initialHistoryStatus,
} from "$server/domain/motorcycle-catalog";
import {
  BENCHMARK_MIN_SAMPLE_SIZE,
  comparableBenchmarkMetrics,
  compareBenchmarkMetric,
  hasComparableBenchmarkMetric,
  modelBenchmarkKey,
  type BenchmarkPosition,
} from "$server/domain/model-benchmark";
import type { FuelRecord } from "$server/domain/fuel";

const DOCUMENT_HORIZON_DAYS = 30;

type Row = Record<string, unknown>;

type BenchmarkSummaryRow = {
  sample_size: number | string;
  consumption_sample_size: number | string;
  average_consumption_km_l: number | string | null;
  maintenance_sample_size: number | string;
  average_maintenance_cents: number | string | null;
};

type BenchmarkComparison = {
  sampleSize: number;
  available: boolean;
  average: number | null;
  position: BenchmarkPosition;
  differencePercent: number | null;
};

type BenchmarkData = {
  motorcycleId: string | null;
  modelLabel: string;
  models: Array<{ id: string; name: string; label: string }>;
  sampleSize: number;
  minimumSampleSize: number;
  submitted: boolean;
  hasComparableMetric: boolean;
  local: {
    consumptionKmL: number | null;
    maintenanceCentsPer1000Km: number | null;
    consumptionIntervals: number;
    maintenanceRecords: number;
    distanceKm: number | null;
  } | null;
  cohort: {
    consumption: BenchmarkComparison;
    maintenance: BenchmarkComparison;
  } | null;
};

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function formValue(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

const sumCents = (rows: Row[], key: string) =>
  rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);

function daysUntil(date: string, today: string) {
  const target = new Date(`${date.slice(0, 10)}T00:00:00.000Z`).getTime();
  const now = new Date(`${today}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.round((target - now) / 86_400_000);
}

// Keep a degraded dashboard renderable when one optional panel query fails, but
// retain a signal so the UI can distinguish an outage from a genuinely empty
// account. The old implementation swallowed the failure into an empty array,
// which made a database outage look like a fresh account.
function rowsOrEmpty<T>(
  promise: Promise<T[]>,
  onError: () => void,
): Promise<T[]> {
  return promise.catch(() => {
    onError();
    return [] as T[];
  });
}

export async function load({ locals, url }) {
  const user = locals.user;
  const today = new Date().toISOString().slice(0, 10);

  if (!user) {
    return {
      today,
      metrics: [],
      garage: [],
      health: null,
      consumption: [],
      spend: [],
      costs: [],
      activity: [],
      upcoming: [],
      dueNow: [],
      counts: { reminders: 0, tires: 0, documents: 0 },
      benchmark: null,
    };
  }

  const ownerId = user.id;
  let motorcycleCountRow: { count: number } | undefined;
  try {
    [motorcycleCountRow] = await locals.db<Array<{ count: number }>>`
      select count(*)::int from motorcycles where owner_id = ${ownerId}
    `;
  } catch {
    return {
      today,
      metrics: [],
      garage: [],
      health: null,
      consumption: [],
      spend: [],
      costs: [],
      activity: [],
      upcoming: [],
      dueNow: [],
      counts: { reminders: 0, tires: 0, documents: 0 },
      benchmark: null,
      errorMessage: translate(locals.locale, "common.loadError"),
    };
  }
  // Same emptiness rule as /onboarding: any motorcycle counts, including
  // archived ones, so inactive-only garages never bounce between routes.
  if (!motorcycleCountRow?.count) {
    throw redirect(303, "/onboarding");
  }

  let loadError = false;
  const markLoadError = () => {
    loadError = true;
  };
  const [
    motorcycleRows,
    fuelRows,
    reminderRows,
    tireRows,
    documentRows,
    maintenanceRows,
    feeRows,
    planRows,
  ] = await Promise.all([
    rowsOrEmpty(
      locals.db<Row[]>`
        select id, name, brand, model, year, current_odometer_km
        from motorcycles
        where owner_id = ${ownerId} and is_active = true
        order by name
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select motorcycle_id, date, odometer_km, liters, total_price_cents, tank_full
        from fuel_records
        where owner_id = ${ownerId}
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select id, title, motorcycle_id, trigger_type, trigger_value_km,
          trigger_value_days, reference_km, reference_date
        from reminders
        where owner_id = ${ownerId} and is_active = true
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select motorcycle_id, installed_at, cost_cents, wear_percent
        from tire_records
        where owner_id = ${ownerId} and is_active = true
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select name, motorcycle_id, valid_until
        from motorcycle_documents
        where owner_id = ${ownerId}
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select motorcycle_id, date, odometer_km, cost_cents, maintenance_type
        from maintenance_records
        where owner_id = ${ownerId}
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select due_date, amount_cents, fee_type
        from annual_fees
        where owner_id = ${ownerId}
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select p.id, p.motorcycle_id, p.maintenance_type, p.interval_km,
          p.last_done_km, p.initial_history_status, p.estimated_cost_cents,
          m.name as motorcycle_name, ms.official_url, ms.document_version,
          ms.page_reference
        from maintenance_plan_items p
        join motorcycles m on m.id = p.motorcycle_id
        left join motorcycle_manual_sources ms on ms.id = p.manual_source_id
        where p.owner_id = ${ownerId} and p.is_active = true and m.is_active = true
      `,
      markLoadError,
    ),
  ]);

  const summary = dashboardSummary(fuelRows as never);
  const odometerFor = new Map(
    motorcycleRows.map((row) => [
      String(row.id),
      Number(row.current_odometer_km ?? 0),
    ]),
  );

  const dueNow = planRows
    .map((plan) => {
      const status = dueStateForPlan({
        historyStatus: initialHistoryStatus(
          String(plan.initial_history_status ?? "unknown"),
        ),
        lastDoneKm:
          plan.last_done_km == null ? null : Number(plan.last_done_km),
        intervalKm: plan.interval_km == null ? null : Number(plan.interval_km),
        currentKm: odometerFor.get(String(plan.motorcycle_id)) ?? 0,
      });
      return {
        id: String(plan.id),
        motorcycleName: String(plan.motorcycle_name ?? "Moto"),
        maintenanceType: String(plan.maintenance_type ?? "Manutenção"),
        urgency: status.urgency,
        dueKm: status.dueKm,
        estimatedCostCents: Number(plan.estimated_cost_cents ?? 0),
        officialUrl: String(plan.official_url ?? ""),
        documentVersion: String(plan.document_version ?? ""),
        pageReference: String(plan.page_reference ?? ""),
      };
    })
    .filter((plan) => plan.urgency !== "scheduled")
    .sort((a, b) => {
      const rank = { overdue: 0, due_now: 1, scheduled: 2 } as const;
      return rank[a.urgency] - rank[b.urgency];
    })
    .slice(0, 5);

  // Only documents actually inside the renewal window count against health —
  // a CRLV valid for another two years is not a problem to solve today.
  const expiringDocuments = documentRows.filter((row) => {
    if (!row.valid_until) return false;
    const remaining = daysUntil(String(row.valid_until), today);
    return remaining !== null && remaining <= DOCUMENT_HORIZON_DAYS;
  });

  // Health is scored per bike and the garage headline takes the worst one, so a
  // neglected second bike cannot hide behind a healthy daily rider.
  const garage = motorcycleRows.map((row) => {
    const id = String(row.id);
    const odometer = Number(row.current_odometer_km ?? 0);
    return {
      id,
      name: String(row.name ?? "Sem nome"),
      detail: [row.brand, row.model].filter(Boolean).join(" ") || "—",
      odometer,
      health: healthScore({
        reminders: reminderRows.filter(
          (reminder) => String(reminder.motorcycle_id) === id,
        ) as unknown as ReminderInput[],
        currentOdometerKm: odometer,
        today,
        tireWear: tireRows
          .filter((tire) => String(tire.motorcycle_id) === id)
          .map((tire) => Number(tire.wear_percent ?? 0))
          .filter((wear) => Number.isFinite(wear) && wear > 0),
        documentsExpiring: expiringDocuments.filter(
          (document) => String(document.motorcycle_id) === id,
        ).length,
      }),
    };
  });

  const health = garage.length
    ? garage.reduce((worst, entry) =>
        entry.health.total < worst.health.total ? entry : worst,
      )
    : null;

  const upcoming = reminderRows
    .map((row) => {
      const evaluation = evaluateReminder(row as unknown as ReminderInput, {
        currentOdometerKm: odometerFor.get(String(row.motorcycle_id)) ?? 0,
        today,
      });
      return {
        id: String(row.id),
        title: String(row.title ?? "Lembrete"),
        status: evaluation.status,
        remainingKm: evaluation.remaining_km ?? null,
        remainingDays: evaluation.remaining_days ?? null,
      };
    })
    .filter((entry) => entry.status !== "unknown")
    .sort((a, b) => {
      const rank = { overdue: 0, due_soon: 1, ok: 2, unknown: 3 } as const;
      return rank[a.status] - rank[b.status];
    })
    .slice(0, 4);

  const fuelSpend = summary.fuel_spend_cents;
  const maintenanceSpend = sumCents(maintenanceRows, "cost_cents");
  const tireSpend = sumCents(tireRows, "cost_cents");
  const feeSpend = sumCents(feeRows, "amount_cents");

  // Built per-request, so unlike the process-wide pricing cache this can safely
  // read the reader's locale off locals rather than baking one in.
  const locale = locals.locale;
  const tr = (key: MessageKey) => translate(locale, key);
  const primary = motorcycleRows[0];
  const metrics = [
    {
      label: tr("dashboard.metricBikes"),
      value: formatNumber(locale, motorcycleRows.length),
      detail: tr("dashboard.metricBikesDetail"),
    },
    {
      label: tr("dashboard.metricOdometer"),
      value: formatDistance(locale, Number(primary?.current_odometer_km ?? 0)),
      detail: String(primary?.name ?? tr("dashboard.noActiveBike")),
    },
    {
      label: tr("dashboard.metricConsumption"),
      value: summary.average_consumption_km_l
        ? `${formatNumber(locale, summary.average_consumption_km_l)} km/L`
        : tr("dashboard.noData"),
      detail: tr("dashboard.metricConsumptionDetail"),
    },
    {
      label: tr("dashboard.metricCostPerKm"),
      value: summary.cost_per_km
        ? formatMoney(locale, summary.cost_per_km * 100)
        : tr("dashboard.noData"),
      detail: tr("dashboard.metricCostPerKmDetail"),
    },
  ];

  // Benchmarking is opt-in and scoped to one selected motorcycle. The query
  // parameter lets a rider choose another bike in the form without silently
  // changing which model is being compared on the next render.
  const requestedBenchmarkMotorcycleId = url.searchParams.get("benchmark");
  const benchmarkMotorcycle =
    motorcycleRows.find(
      (row) =>
        String(row.id) === requestedBenchmarkMotorcycleId &&
        modelBenchmarkKey(
          String(row.brand ?? ""),
          String(row.model ?? ""),
          Number(row.year),
        ),
    ) ??
    motorcycleRows.find((row) =>
      modelBenchmarkKey(
        String(row.brand ?? ""),
        String(row.model ?? ""),
        Number(row.year),
      ),
    );
  const benchmarkModels = motorcycleRows
    .map((row) => {
      const key = modelBenchmarkKey(
        String(row.brand ?? ""),
        String(row.model ?? ""),
        Number(row.year),
      );
      return {
        id: String(row.id),
        name: String(row.name ?? "Moto"),
        label: [row.brand, row.model, row.year]
          .filter(
            (value) => value !== null && value !== undefined && value !== "",
          )
          .join(" "),
        key,
      };
    })
    .filter((row) => row.key);

  let benchmark: BenchmarkData | null = null;
  if (benchmarkMotorcycle) {
    const benchmarkKey = modelBenchmarkKey(
      String(benchmarkMotorcycle.brand ?? ""),
      String(benchmarkMotorcycle.model ?? ""),
      Number(benchmarkMotorcycle.year),
    );
    const benchmarkFuelRows = fuelRows.filter(
      (row) =>
        String(row.motorcycle_id ?? "") === String(benchmarkMotorcycle.id),
    );
    const benchmarkMaintenanceRows = maintenanceRows.filter(
      (row) =>
        String(row.motorcycle_id ?? "") === String(benchmarkMotorcycle.id),
    );
    const localMetrics = comparableBenchmarkMetrics(
      benchmarkFuelRows as unknown as FuelRecord[],
      benchmarkMaintenanceRows,
    );
    const [summaryRow] = await locals.db<BenchmarkSummaryRow[]>`
      select
        sample_size,
        consumption_sample_size,
        average_consumption_km_l,
        maintenance_sample_size,
        average_maintenance_cents
      from model_benchmark_summary(${benchmarkKey})
    `.catch(() => [] as BenchmarkSummaryRow[]);
    const [submissionGuard] = await locals.db<
      Array<{ contribution_id: string }>
    >`
      select contribution_id
      from model_benchmark_submission_guards
      where owner_id = ${ownerId} and model_key = ${benchmarkKey}
      limit 1
    `.catch(() => [] as Array<{ contribution_id: string }>);
    const sampleSize = Number(summaryRow?.sample_size ?? 0);
    const averageConsumption =
      summaryRow?.average_consumption_km_l == null
        ? null
        : Number(summaryRow.average_consumption_km_l);
    const averageMaintenance =
      summaryRow?.average_maintenance_cents == null
        ? null
        : Number(summaryRow.average_maintenance_cents);
    const consumptionSampleSize = Number(
      summaryRow?.consumption_sample_size ?? 0,
    );
    const maintenanceSampleSize = Number(
      summaryRow?.maintenance_sample_size ?? 0,
    );
    const consumptionComparison = compareBenchmarkMetric(
      localMetrics.consumptionKmL,
      averageConsumption,
      consumptionSampleSize,
    );
    const maintenanceComparison = compareBenchmarkMetric(
      localMetrics.maintenanceCentsPer1000Km,
      averageMaintenance,
      maintenanceSampleSize,
    );
    benchmark = {
      motorcycleId: String(benchmarkMotorcycle.id),
      modelLabel:
        [
          benchmarkMotorcycle.brand,
          benchmarkMotorcycle.model,
          benchmarkMotorcycle.year,
        ]
          .filter(Boolean)
          .join(" ") || "Modelo não informado",
      models: benchmarkModels.map((model) => ({
        id: model.id,
        name: model.name,
        label: model.label,
      })),
      sampleSize,
      minimumSampleSize: BENCHMARK_MIN_SAMPLE_SIZE,
      submitted: Boolean(submissionGuard),
      hasComparableMetric: hasComparableBenchmarkMetric(localMetrics),
      local: {
        consumptionKmL: localMetrics.consumptionKmL,
        maintenanceCentsPer1000Km: localMetrics.maintenanceCentsPer1000Km,
        consumptionIntervals: localMetrics.consumptionIntervals,
        maintenanceRecords: localMetrics.maintenanceRecords,
        distanceKm: localMetrics.distanceKm,
      },
      cohort: {
        consumption: consumptionComparison,
        maintenance: maintenanceComparison,
      },
    };
  } else if (benchmarkModels.length === 0) {
    benchmark = {
      motorcycleId: null,
      modelLabel: "",
      models: [],
      sampleSize: 0,
      minimumSampleSize: BENCHMARK_MIN_SAMPLE_SIZE,
      submitted: false,
      hasComparableMetric: false,
      local: null,
      cohort: null,
    };
  }

  return {
    today,
    metrics,
    garage,
    health: health?.health ?? null,
    healthMotorcycle: garage.length > 1 ? (health?.name ?? null) : null,
    consumption: consumptionTrend(fuelRows as never).map((point) => ({
      date: point.date,
      value: point.kmPerLiter,
    })),
    spend: spendByMonth(
      [
        ...fuelRows.map((row) => ({
          date: String(row.date ?? ""),
          amountCents: Number(row.total_price_cents ?? 0),
        })),
        ...maintenanceRows.map((row) => ({
          date: String(row.date ?? ""),
          amountCents: Number(row.cost_cents ?? 0),
        })),
        ...tireRows.map((row) => ({
          date: String(row.installed_at ?? ""),
          amountCents: Number(row.cost_cents ?? 0),
        })),
        ...feeRows.map((row) => ({
          date: String(row.due_date ?? ""),
          amountCents: Number(row.amount_cents ?? 0),
        })),
      ],
      { today },
    ),
    costs: costBreakdown({
      fuel: fuelSpend,
      maintenance: maintenanceSpend,
      tires: tireSpend,
      fees: feeSpend,
    }),
    activity: activityCalendar(
      [
        ...fuelRows.map((row) => String(row.date ?? "")),
        ...maintenanceRows.map((row) => String(row.date ?? "")),
        ...tireRows.map((row) => String(row.installed_at ?? "")),
        ...feeRows.map((row) => String(row.due_date ?? "")),
      ].filter(Boolean),
      { today },
    ),
    upcoming,
    dueNow,
    counts: {
      reminders: reminderRows.length,
      tires: tireRows.length,
      documents: expiringDocuments.length,
    },
    benchmark,
    errorMessage: loadError ? translate(locals.locale, "common.loadError") : "",
  };
}

export const actions: Actions = {
  contributeBenchmark: async ({ request, locals }) => {
    const ownerId = locals.user?.id;
    if (!ownerId) return fail(401, { message: "Entre para compartilhar." });

    const form = await request.formData();
    const motorcycleId = formValue(form, "motorcycle_id");
    const consent = formValue(form, "consent");
    if (!motorcycleId) {
      return fail(400, { message: "Escolha uma moto para comparar." });
    }
    if (!consent || !["on", "true", "1"].includes(consent)) {
      return fail(400, {
        message: "Confirme o compartilhamento anônimo para continuar.",
      });
    }

    let motorcycle: Row | undefined;
    let fuelRows: Row[] = [];
    let maintenanceRows: Row[] = [];
    try {
      [motorcycle] = await locals.db<Row[]>`
        select id, brand, model, year
        from motorcycles
        where id = ${motorcycleId} and owner_id = ${ownerId}
        limit 1
      `;
      if (!motorcycle) {
        return fail(400, { message: "Motocicleta não encontrada." });
      }
      [fuelRows, maintenanceRows] = await Promise.all([
        locals.db<Row[]>`
          select date, odometer_km, liters, tank_full
          from fuel_records
          where owner_id = ${ownerId} and motorcycle_id = ${motorcycleId}
        `,
        locals.db<Row[]>`
          select date, odometer_km, cost_cents
          from maintenance_records
          where owner_id = ${ownerId} and motorcycle_id = ${motorcycleId}
        `,
      ]);
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }

    const benchmarkKey = modelBenchmarkKey(
      String(motorcycle.brand ?? ""),
      String(motorcycle.model ?? ""),
      Number(motorcycle.year),
    );
    if (!benchmarkKey) {
      return fail(400, {
        message:
          "Complete marca, modelo e ano da moto antes de participar do comparativo.",
      });
    }

    const metrics = comparableBenchmarkMetrics(
      fuelRows as unknown as FuelRecord[],
      maintenanceRows,
    );
    if (!hasComparableBenchmarkMetric(metrics)) {
      return fail(400, {
        message:
          "Ainda não há histórico comparável. Registre dois tanques cheios ou uma manutenção com odômetros consistentes.",
      });
    }

    try {
      await locals.db.begin(async (tx) => {
        // One guard row per account/model. Reusing its opaque contribution id
        // makes a later explicit submission an upsert, while the benchmark
        // table never receives owner_id.
        const [guard] = await tx<Array<{ contribution_id: string }>>`
          insert into model_benchmark_submission_guards (owner_id, model_key)
          values (${ownerId}, ${benchmarkKey})
          on conflict (owner_id, model_key)
          do update set updated_at = now()
          returning contribution_id
        `;
        if (!guard?.contribution_id) {
          throw new Error("Não foi possível reservar a contribuição anônima.");
        }

        await tx`
          insert into anonymous_model_benchmark_contributions
            (id, model_key, consumption_km_l, maintenance_cents)
          values (
            ${guard.contribution_id},
            ${benchmarkKey},
            ${metrics.consumptionKmL},
            ${metrics.maintenanceCentsPer1000Km}
          )
          on conflict (id)
          do update set
            model_key = excluded.model_key,
            consumption_km_l = excluded.consumption_km_l,
            maintenance_cents = excluded.maintenance_cents,
            updated_at = now()
        `;
      });
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }

    throw redirect(
      303,
      `/dashboard?benchmark=${encodeURIComponent(motorcycleId)}`,
    );
  },
};
