import { createTranslator } from "$lib/i18n";
import { redirect } from "@sveltejs/kit";
import { dashboardSummary, healthScore } from "$server/domain/reports";
import { evaluateReminder, type ReminderInput } from "$server/domain/reminders";
import {
  activityCalendar,
  consumptionTrend,
  costBreakdown,
  costPerKmWindow,
  spendByMonth,
} from "$server/domain/dashboard";
import { formatDistance, translate, type MessageKey } from "$lib/i18n";
import {
  buildDueNow,
  DUE_NOW_LIMIT,
  mostUrgentFor,
  rankAttention,
  type AttentionItem,
  type AttentionReminder,
} from "$server/domain/due-now";
import { privateFileUrl } from "$lib/utils/private-file-url";
import {
  BENCHMARK_MIN_SAMPLE_SIZE,
  comparableBenchmarkMetrics,
  compareBenchmarkMetric,
  hasComparableBenchmarkMetric,
  modelBenchmarkKey,
  type BenchmarkPosition,
} from "$server/domain/model-benchmark";
import type { FuelRecord } from "$server/domain/fuel";
import { isoDateValue } from "$server/domain/date-value";

import { appToday } from "$lib/utils/calendar-day";
const DOCUMENT_HORIZON_DAYS = 30;
const COST_WINDOW_DAYS = 30;
/** Rows of "also needs attention" under the bike home's lead item. */
const ATTENTION_LIMIT = 4;

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

const sumCents = (rows: Row[], key: string) =>
  rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);

function daysUntil(date: unknown, today: string) {
  const target = new Date(`${isoDateValue(date)}T00:00:00.000Z`).getTime();
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

type GarageLoadEvent = {
  locals: App.Locals;
  url: URL;
  parent: () => Promise<{ activeMotorcycleId: string | null }>;
};

export async function load(event) {
  return _loadGarage(event);
}

/**
 * The bike home and the Análises page read the same garage summary. Only
 * Análises asks for the opt-in model comparison, which costs two extra
 * queries the home screen no longer shows.
 */
export async function _loadGarage(
  { locals, url, parent }: GarageLoadEvent,
  { includeBenchmark = false } = {},
) {
  const user = locals.user;
  const today = appToday();

  if (!user) {
    return {
      today,
      hero: null,
      nextDue: null,
      attention: [],
      headline: null,
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
      recentActivity: [],
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
      hero: null,
      nextDue: null,
      attention: [],
      headline: null,
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
      recentActivity: [],
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
        select id, name, brand, model, year, current_odometer_km, photo_key
        from motorcycles
        where owner_id = ${ownerId} and is_active = true and deleted_at is null
        order by name
      `,
      markLoadError,
    ),
    // Date columns are cast to text: postgres.js returns `date` as a JS Date,
    // and `String(Date)` is not the YYYY-MM-DD the charts bucket by.
    rowsOrEmpty(
      locals.db<Row[]>`
        select id, motorcycle_id, date::text as date, odometer_km, liters, total_price_cents, tank_full
        from fuel_records
        where owner_id = ${ownerId}
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select id, title, motorcycle_id, trigger_type, trigger_value_km,
          trigger_value_days, reference_km, reference_date::text as reference_date,
          snoozed_until_date::text as snoozed_until_date, snoozed_until_km
        from reminders
        where owner_id = ${ownerId} and is_active = true
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select id, motorcycle_id, installed_at::text as installed_at, cost_cents, wear_percent,
          is_active
        from tire_records
        where owner_id = ${ownerId}
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select name, motorcycle_id, valid_until::text as valid_until
        from motorcycle_documents
        where owner_id = ${ownerId}
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select id, motorcycle_id, date::text as date, odometer_km, cost_cents, maintenance_type
        from maintenance_records
        where owner_id = ${ownerId}
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select id, motorcycle_id, due_date::text as due_date, amount_cents, fee_type
        from annual_fees
        where owner_id = ${ownerId}
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<Row[]>`
        select p.id, p.motorcycle_id, p.maintenance_type, p.interval_km, p.interval_days,
          p.last_done_km, p.last_done_date, p.initial_history_status, p.estimated_cost_cents,
          p.schedule_milestones, p.recurrence_km, p.recurrence_months, p.last_completed_milestone,
          p.calendar_anchor_mode,
          m.in_service_date,
          m.name as motorcycle_name, ms.official_url, ms.document_version,
          ms.page_reference
        from maintenance_plan_items p
        join motorcycles m on m.id = p.motorcycle_id and m.owner_id = p.owner_id
        left join motorcycle_manual_sources ms on ms.id = p.manual_source_id
        where p.owner_id = ${ownerId} and p.is_active = true and m.is_active = true
      `,
      markLoadError,
    ),
  ]);

  const odometerFor = new Map(
    motorcycleRows.map((row) => [
      String(row.id),
      Number(row.current_odometer_km ?? 0),
    ]),
  );
  const nameFor = new Map(
    motorcycleRows.map((row) => [String(row.id), String(row.name ?? "Moto")]),
  );

  // A retired tire's purchase still counts as spending; only active tires
  // describe the bike's current tire health.
  const activeTireRows = tireRows.filter((row) => row.is_active === true);

  // Uncapped, so the bike on screen can always find its own lead item; the
  // garage-wide list keeps the same per-bike spread, capped.
  const allDueNow = buildDueNow({
    rows: planRows,
    odometerByMotorcycle: odometerFor,
    limit: Number.POSITIVE_INFINITY,
  });
  const dueNow = allDueNow.slice(0, DUE_NOW_LIMIT);

  // Only documents actually inside the renewal window count against health —
  // a CRLV valid for another two years is not a problem to solve today.
  const expiringDocuments = documentRows.filter((row) => {
    if (!row.valid_until) return false;
    const remaining = daysUntil(row.valid_until, today);
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
      modelLabel: [row.brand, row.model, row.year]
        .filter(
          (value) => value !== null && value !== undefined && value !== "",
        )
        .join(" "),
      photoUrl: privateFileUrl(row.photo_key ? String(row.photo_key) : null),
      odometer,
      health: healthScore({
        reminders: reminderRows.filter(
          (reminder) => String(reminder.motorcycle_id) === id,
        ) as unknown as ReminderInput[],
        currentOdometerKm: odometer,
        today,
        tireWear: activeTireRows
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

  // The bike home leads with one motorcycle: the one chosen in the shell's bike
  // switcher (resolved by the layout; awaiting parent() re-runs this load after
  // a switch), else the first active bike by name. Every query above is
  // owner-scoped, so an id from another account simply does not match.
  const { activeMotorcycleId } = await parent();
  const hero =
    garage.find((entry) => entry.id === activeMotorcycleId) ??
    garage[0] ??
    null;
  const heroId = hero?.id ?? "";

  const evaluatedReminders: AttentionReminder[] = reminderRows
    .filter((row) => {
      // A reminder for an archived bike has no live odometer to measure from.
      const motorcycleId = row.motorcycle_id ? String(row.motorcycle_id) : null;
      return motorcycleId === null || odometerFor.has(motorcycleId);
    })
    .map((row) => {
      const motorcycleId = row.motorcycle_id ? String(row.motorcycle_id) : null;
      const evaluation = evaluateReminder(row as unknown as ReminderInput, {
        currentOdometerKm: motorcycleId
          ? (odometerFor.get(motorcycleId) ?? 0)
          : 0,
        today,
      });
      return {
        id: String(row.id),
        title: String(row.title ?? "Lembrete"),
        motorcycleId,
        motorcycleName: motorcycleId ? (nameFor.get(motorcycleId) ?? "") : "",
        status: evaluation.status,
        remainingKm: evaluation.remaining_km ?? null,
        remainingDays: evaluation.remaining_days ?? null,
      };
    });

  const upcoming = evaluatedReminders
    .filter((entry) => entry.status !== "unknown")
    .sort((a, b) => {
      const rank = { overdue: 0, due_soon: 1, ok: 2, unknown: 3 } as const;
      return rank[a.status] - rank[b.status];
    })
    .slice(0, 4)
    .map(({ id, title, status, remainingKm, remainingDays }) => ({
      id,
      title,
      status,
      remainingKm,
      remainingDays,
    }));

  const nextDue: AttentionItem | null = hero
    ? mostUrgentFor(
        rankAttention({ dueNow: allDueNow, reminders: evaluatedReminders }),
        heroId,
      )
    : null;
  const attention = rankAttention({ dueNow, reminders: evaluatedReminders })
    .filter(
      (item) =>
        !nextDue || item.kind !== nextDue.kind || item.id !== nextDue.id,
    )
    .slice(0, ATTENTION_LIMIT);

  // Headline numbers describe the bike on screen, not the garage blend: mixing
  // two bikes' tanks would also corrupt the full-tank-to-full-tank intervals.
  const forHero = (row: Row) => String(row.motorcycle_id ?? "") === heroId;
  const heroFuelRows = fuelRows.filter(forHero);
  const heroMaintenanceRows = maintenanceRows.filter(forHero);
  const heroTireRows = tireRows.filter(forHero);
  const heroSummary = dashboardSummary(heroFuelRows as never);
  const headline = hero
    ? {
        windowDays: COST_WINDOW_DAYS,
        // Fuel, service and tires; annual fees are left out so a once-a-year
        // IPVA bill cannot swamp one month's cost per km.
        costPerKm: costPerKmWindow({
          spend: [
            ...heroFuelRows.map((row) => ({
              date: String(row.date ?? ""),
              amountCents: Number(row.total_price_cents ?? 0),
            })),
            ...heroMaintenanceRows.map((row) => ({
              date: String(row.date ?? ""),
              amountCents: Number(row.cost_cents ?? 0),
            })),
            ...heroTireRows.map((row) => ({
              date: String(row.installed_at ?? ""),
              amountCents: Number(row.cost_cents ?? 0),
            })),
          ],
          readings: [...heroFuelRows, ...heroMaintenanceRows].map((row) => ({
            date: String(row.date ?? ""),
            // Missing is not 0 km: a 0 reading is a valid baseline.
            odometerKm:
              row.odometer_km == null ? Number.NaN : Number(row.odometer_km),
          })),
          today,
          days: COST_WINDOW_DAYS,
        }),
        averageConsumptionKmL: heroSummary.average_consumption_km_l || null,
      }
    : null;

  const fuelSpend = sumCents(fuelRows, "total_price_cents");
  const maintenanceSpend = sumCents(maintenanceRows, "cost_cents");
  const tireSpend = sumCents(tireRows, "cost_cents");
  const feeSpend = sumCents(feeRows, "amount_cents");

  // Built per-request, so unlike the process-wide pricing cache this can safely
  // read the reader's locale off locals rather than baking one in.
  const locale = locals.locale;
  const tr = (key: MessageKey) => translate(locale, key);

  // Benchmarking is opt-in and scoped to one selected motorcycle. The query
  // parameter lets a rider choose another bike in the form without silently
  // changing which model is being compared on the next render.
  const requestedBenchmarkMotorcycleId =
    url.searchParams.get("benchmark") ?? heroId;
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
  if (includeBenchmark && benchmarkMotorcycle) {
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
          .join(" ") ||
        createTranslator(locals.locale)("dashboard.modelNotProvided"),
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
  } else if (includeBenchmark && benchmarkModels.length === 0) {
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
    hero,
    nextDue,
    attention,
    headline,
    garage,
    health: health?.health ?? null,
    healthMotorcycle: garage.length > 1 ? (health?.name ?? null) : null,
    consumption: consumptionTrend(heroFuelRows as never).map((point) => ({
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
      tires: activeTireRows.length,
      documents: expiringDocuments.length,
    },
    benchmark,
    recentActivity: [
      ...fuelRows.map((row) => ({
        id: `fuel-${row.id ?? row.date}-${row.odometer_km}`,
        type: "fuel",
        date: String(row.date ?? ""),
        title: `${row.liters ?? 0}L ${tr("dashboard.costFuel")}`,
        subtitle: row.odometer_km
          ? formatDistance(locale, Number(row.odometer_km))
          : "",
        amountCents: Number(row.total_price_cents ?? 0),
        href: "/fuel",
      })),
      ...maintenanceRows.map((row) => ({
        id: `maint-${row.id ?? row.date}-${row.odometer_km}`,
        type: "maintenance",
        date: String(row.date ?? ""),
        title: String(row.maintenance_type ?? tr("dashboard.costMaintenance")),
        subtitle: row.odometer_km
          ? formatDistance(locale, Number(row.odometer_km))
          : "",
        amountCents: Number(row.cost_cents ?? 0),
        href: "/maintenance",
      })),
      ...tireRows.map((row) => ({
        id: `tire-${row.id ?? row.installed_at}`,
        type: "tires",
        date: String(row.installed_at ?? ""),
        title: tr("dashboard.costTires"),
        subtitle: row.wear_percent ? `${row.wear_percent}%` : "",
        amountCents: Number(row.cost_cents ?? 0),
        href: "/tires",
      })),
      ...feeRows.map((row) => ({
        id: `fee-${row.id ?? row.due_date}`,
        type: "expenses",
        date: String(row.due_date ?? ""),
        title: String(row.fee_type ?? tr("dashboard.costFees")),
        subtitle: "",
        amountCents: Number(row.amount_cents ?? 0),
        href: "/expenses",
      })),
    ]
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
      .slice(0, 10),
    errorMessage: loadError ? translate(locals.locale, "common.loadError") : "",
  };
}
