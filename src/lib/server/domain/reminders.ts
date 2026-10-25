export type TriggerType = "by_km" | "by_date" | "by_interval";
export type ReminderStatus = "overdue" | "due_soon" | "ok" | "unknown";

export type ReminderInput = {
  trigger_type: TriggerType;
  trigger_value_km?: number | null;
  trigger_value_days?: number | null;
  reference_km?: number | null;
  reference_date?: unknown;
  snoozed_until_date?: unknown;
  snoozed_until_km?: number | null;
};

export type ReminderEvaluation = {
  status: ReminderStatus;
  due_km?: number;
  remaining_km?: number;
  due_date?: string;
  remaining_days?: number;
  snoozed?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function remainingDays(dueDate: string, today: string) {
  const due = new Date(`${dueDate}T00:00:00.000Z`).getTime();
  const now = new Date(`${today}T00:00:00.000Z`).getTime();
  return Math.round((due - now) / DAY_MS);
}

function evaluateKm(
  referenceKm: number,
  triggerKm: number,
  currentOdometerKm: number,
): ReminderEvaluation {
  const dueKm = referenceKm + triggerKm;
  const remainingKm = dueKm - currentOdometerKm;
  if (remainingKm <= 0)
    return { status: "overdue", due_km: dueKm, remaining_km: remainingKm };
  if (remainingKm <= 200)
    return { status: "due_soon", due_km: dueKm, remaining_km: remainingKm };
  return { status: "ok", due_km: dueKm, remaining_km: remainingKm };
}

function evaluateDate(
  referenceDate: string,
  triggerDays: number,
  today: string,
): ReminderEvaluation {
  const dueDate = addCalendarDays(referenceDate, triggerDays);
  if (!dueDate) return { status: "unknown" };
  const remaining = remainingDays(dueDate, today);
  if (remaining <= 0)
    return { status: "overdue", due_date: dueDate, remaining_days: remaining };
  if (remaining <= 7)
    return { status: "due_soon", due_date: dueDate, remaining_days: remaining };
  return { status: "ok", due_date: dueDate, remaining_days: remaining };
}

export function evaluateReminder(
  reminder: ReminderInput,
  { currentOdometerKm, today }: { currentOdometerKm: number; today: string },
): ReminderEvaluation {
  const referenceDate = validDate(reminder.reference_date);
  const snoozedDate = validDate(reminder.snoozed_until_date);
  // Deferral is separate from the last service. For combined reminders it
  // gates the whole reminder, so the untouched axis cannot notify immediately.
  if (snoozedDate && snoozedDate > today) {
    return {
      status: "ok",
      due_date: snoozedDate,
      remaining_days: remainingDays(snoozedDate, today),
      snoozed: true,
    };
  }
  if (
    reminder.snoozed_until_km != null &&
    Number.isFinite(reminder.snoozed_until_km) &&
    reminder.snoozed_until_km > currentOdometerKm
  ) {
    return {
      status: "ok",
      due_km: reminder.snoozed_until_km,
      remaining_km: reminder.snoozed_until_km - currentOdometerKm,
      snoozed: true,
    };
  }
  const hasKm =
    reminder.reference_km != null &&
    Number.isFinite(reminder.reference_km) &&
    reminder.reference_km >= 0 &&
    reminder.trigger_value_km != null &&
    Number.isFinite(reminder.trigger_value_km) &&
    reminder.trigger_value_km >= 0 &&
    Number.isFinite(currentOdometerKm) &&
    currentOdometerKm >= 0;
  const hasDate =
    referenceDate !== null &&
    reminder.trigger_value_days != null &&
    Number.isFinite(reminder.trigger_value_days) &&
    reminder.trigger_value_days >= 0;
  if (reminder.trigger_type === "by_km") {
    if (!hasKm) return { status: "unknown" };
    return evaluateKm(
      reminder.reference_km!,
      reminder.trigger_value_km!,
      currentOdometerKm,
    );
  }

  if (reminder.trigger_type === "by_date") {
    if (!hasDate) return { status: "unknown" };
    return evaluateDate(referenceDate!, reminder.trigger_value_days!, today);
  }

  const evaluations: ReminderEvaluation[] = [];
  if (hasKm) {
    evaluations.push(
      evaluateKm(
        reminder.reference_km!,
        reminder.trigger_value_km!,
        currentOdometerKm,
      ),
    );
  }
  if (hasDate) {
    evaluations.push(
      evaluateDate(referenceDate!, reminder.trigger_value_days!, today),
    );
  }
  if (!evaluations.length) return { status: "unknown" };

  const priority: Record<ReminderStatus, number> = {
    overdue: 0,
    due_soon: 1,
    ok: 2,
    unknown: 3,
  };
  return evaluations.sort((a, b) => priority[a.status] - priority[b.status])[0];
}
import { addCalendarDays, validDate } from "./maintenance-forecast";
