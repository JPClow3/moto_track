import { redirect } from "@sveltejs/kit";
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

const DOCUMENT_HORIZON_DAYS = 30;

type Row = Record<string, unknown>;

const sumCents = (rows: Row[], key: string) =>
  rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);

function daysUntil(date: string, today: string) {
  const target = new Date(`${date.slice(0, 10)}T00:00:00.000Z`).getTime();
  const now = new Date(`${today}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.round((target - now) / 86_400_000);
}

export async function load({ locals }) {
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
      counts: { reminders: 0, tires: 0, documents: 0 },
    };
  }

  const ownerId = user.id;
  const { count: motorcycleCount } = await locals.supabase
    .from("motorcycles")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  // Same emptiness rule as /onboarding: any motorcycle counts, including
  // archived ones, so inactive-only garages never bounce between routes.
  if (!(motorcycleCount ?? 0)) {
    throw redirect(303, "/onboarding");
  }

  const [motorcycles, fuel, reminders, tires, documents, maintenance, fees] =
    await Promise.all([
      locals.supabase
        .from("motorcycles")
        .select("id, name, brand, model, year, current_odometer_km")
        .eq("owner_id", ownerId)
        .eq("is_active", true)
        .order("name"),
      locals.supabase
        .from("fuel_records")
        .select("date, odometer_km, liters, total_price_cents, tank_full")
        .eq("owner_id", ownerId),
      locals.supabase
        .from("reminders")
        .select(
          "id, title, motorcycle_id, trigger_type, trigger_value_km, trigger_value_days, reference_km, reference_date",
        )
        .eq("owner_id", ownerId)
        .eq("is_active", true),
      locals.supabase
        .from("tire_records")
        .select("motorcycle_id, installed_at, cost_cents, wear_percent")
        .eq("owner_id", ownerId)
        .eq("is_active", true),
      locals.supabase
        .from("motorcycle_documents")
        .select("name, motorcycle_id, valid_until")
        .eq("owner_id", ownerId),
      locals.supabase
        .from("maintenance_records")
        .select("date, cost_cents, maintenance_type")
        .eq("owner_id", ownerId),
      locals.supabase
        .from("annual_fees")
        .select("due_date, amount_cents, fee_type")
        .eq("owner_id", ownerId),
    ]);

  const motorcycleRows = (motorcycles.data ?? []) as Row[];
  const fuelRows = (fuel.data ?? []) as Row[];
  const reminderRows = (reminders.data ?? []) as Row[];
  const tireRows = (tires.data ?? []) as Row[];
  const documentRows = (documents.data ?? []) as Row[];
  const maintenanceRows = (maintenance.data ?? []) as Row[];
  const feeRows = (fees.data ?? []) as Row[];

  const summary = dashboardSummary(fuelRows as never);
  const odometerFor = new Map(
    motorcycleRows.map((row) => [
      String(row.id),
      Number(row.current_odometer_km ?? 0),
    ]),
  );

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
    counts: {
      reminders: reminderRows.length,
      tires: tireRows.length,
      documents: expiringDocuments.length,
    },
  };
}
