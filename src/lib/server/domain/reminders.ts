export type TriggerType = "by_km" | "by_date" | "by_interval";
export type ReminderStatus = "overdue" | "due_soon" | "ok" | "unknown";

export type ReminderInput = {
  trigger_type: TriggerType;
  trigger_value_km?: number | null;
  trigger_value_days?: number | null;
  reference_km?: number | null;
  reference_date?: string | null;
};

export type ReminderEvaluation = {
  status: ReminderStatus;
  due_km?: number;
  remaining_km?: number;
  due_date?: string;
  remaining_days?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

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
  const dueDate = addDays(referenceDate, triggerDays);
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
  if (reminder.trigger_type === "by_km") {
    if (reminder.reference_km == null || reminder.trigger_value_km == null)
      return { status: "unknown" };
    return evaluateKm(
      reminder.reference_km,
      reminder.trigger_value_km,
      currentOdometerKm,
    );
  }

  if (reminder.trigger_type === "by_date") {
    if (!reminder.reference_date || reminder.trigger_value_days == null)
      return { status: "unknown" };
    return evaluateDate(
      reminder.reference_date,
      reminder.trigger_value_days,
      today,
    );
  }

  const evaluations: ReminderEvaluation[] = [];
  if (reminder.reference_km != null && reminder.trigger_value_km != null) {
    evaluations.push(
      evaluateKm(
        reminder.reference_km,
        reminder.trigger_value_km,
        currentOdometerKm,
      ),
    );
  }
  if (reminder.reference_date && reminder.trigger_value_days != null) {
    evaluations.push(
      evaluateDate(reminder.reference_date, reminder.trigger_value_days, today),
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
