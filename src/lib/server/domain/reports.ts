import { averageConsumption, costPerKm, type FuelRecord } from "./fuel";
import { evaluateReminder, type ReminderInput } from "./reminders";

/**
 * A locale-independent key rather than a display string: the caller decides how
 * to word it, which is what lets the dashboard translate it. Was
 * `readable_status`, which hardcoded pt-BR inside the domain.
 */
export type HealthStatus = "overdue" | "attention" | "ready";

function healthStatus(total: number): HealthStatus {
  if (total < 50) return "overdue";
  if (total < 80) return "attention";
  return "ready";
}

export function healthScore({
  reminders,
  currentOdometerKm,
  today,
  tireWear = [],
  documentsExpiring = 0,
}: {
  reminders: ReminderInput[];
  currentOdometerKm: number;
  today: string;
  tireWear?: number[];
  documentsExpiring?: number;
}) {
  const reminderPenalty = reminders.reduce((total, reminder) => {
    const status = evaluateReminder(reminder, {
      currentOdometerKm,
      today,
    }).status;
    return total + (status === "overdue" ? 15 : status === "due_soon" ? 7 : 0);
  }, 0);
  const tirePenalty = tireWear.reduce(
    (total, wear) => total + (wear >= 85 ? 12 : wear >= 70 ? 6 : 0),
    0,
  );
  const documentPenalty = documentsExpiring * 5;
  const total = Math.max(
    0,
    100 - reminderPenalty - tirePenalty - documentPenalty,
  );
  return {
    total,
    status: healthStatus(total),
  };
}

export function dashboardSummary(fuelRecords: FuelRecord[]) {
  return {
    average_consumption_km_l: averageConsumption(fuelRecords),
    cost_per_km: costPerKm(fuelRecords),
    fuel_spend_cents: fuelRecords.reduce(
      (sum, record) => sum + Number(record.total_price_cents || 0),
      0,
    ),
  };
}
