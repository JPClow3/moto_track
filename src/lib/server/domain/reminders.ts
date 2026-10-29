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

/** The worker sends once per armed reminder; clearing these re-arms it. */
export const REMINDER_NOTIFICATION_RESET = {
  last_notified_at: null,
  last_email_notified_at: null,
  last_push_notified_at: null,
} as const;

const REMINDER_SCHEDULE_FIELDS = [
  "motorcycle_id",
  "trigger_type",
  "trigger_value_km",
  "trigger_value_days",
  "reference_km",
  "reference_date",
] as const;

function scheduleValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (key === "reference_date") return validDate(value);
  if (key === "trigger_type" || key === "motorcycle_id") return String(value);
  const number = Number(value);
  return Number.isFinite(number) ? number : String(value);
}

/**
 * True when `next` moves the due point or reactivates the reminder, e.g. a
 * renewed document date. Fields absent from `next` are left unchanged by the
 * write, so they are not compared.
 */
export function reminderScheduleChanged(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  if (next.is_active === true && previous.is_active === false) return true;
  return REMINDER_SCHEDULE_FIELDS.some(
    (key) =>
      Object.hasOwn(next, key) &&
      scheduleValue(key, next[key]) !== scheduleValue(key, previous[key]),
  );
}
import { addCalendarDays, validDate } from "./maintenance-forecast";

/** Reminder status plus "paused" for reminders switched off by the rider. */
export type UrgencyStatus = ReminderStatus | "inactive";

const URGENCY_RANK: Record<UrgencyStatus, number> = {
  overdue: 0,
  due_soon: 1,
  ok: 2,
  unknown: 3,
  inactive: 4,
};

/**
 * Most urgent first: overdue, due soon, on track, no reference, paused. Ties
 * keep their incoming order so the database ordering still breaks them.
 */
export function sortByUrgency<T>(
  rows: readonly T[],
  statusOf: (row: T) => UrgencyStatus,
): T[] {
  return rows
    .map((row, index) => ({ row, index, rank: URGENCY_RANK[statusOf(row)] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.row);
}

/**
 * Document validity on `today`: expired the day after `valid_until`, due soon
 * inside its own notice window (30 days when unset), unknown without a date.
 */
export function documentExpiryStatus(
  validUntil: unknown,
  notifyBeforeDays: unknown,
  today: string,
): ReminderStatus {
  const until = validDate(validUntil);
  if (!until) return "unknown";
  const remaining = remainingDays(until, today);
  if (remaining < 0) return "overdue";
  const notice =
    notifyBeforeDays === null ||
    notifyBeforeDays === undefined ||
    notifyBeforeDays === ""
      ? Number.NaN
      : Number(notifyBeforeDays);
  const window = Number.isFinite(notice) && notice >= 0 ? notice : 30;
  return remaining <= window ? "due_soon" : "ok";
}
