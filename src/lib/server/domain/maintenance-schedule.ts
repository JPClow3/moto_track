import { validDate } from "./maintenance-forecast";

export type ScheduleMilestone = { km: number | null; months: number | null };

export function relativeReplacementMonths({
  milestones,
  recurrenceKm,
  recurrenceMonths,
  calendarAnchorMode,
}: {
  milestones: unknown;
  recurrenceKm?: number | null;
  recurrenceMonths?: number | null;
  calendarAnchorMode?: string;
}): number | null {
  const stages = scheduleMilestones(milestones);
  return Array.isArray(milestones) &&
    milestones.length === 1 &&
    stages.length === 1 &&
    stages[0].km === null &&
    stages[0].months !== null &&
    recurrenceKm == null &&
    typeof recurrenceMonths === "number" &&
    Number.isSafeInteger(recurrenceMonths) &&
    recurrenceMonths > 0 &&
    calendarAnchorMode === "last_service"
    ? recurrenceMonths
    : null;
}

export function scheduleMilestones(value: unknown): ScheduleMilestone[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ScheduleMilestone => {
    if (!item || typeof item !== "object") return false;
    const positive = (n: unknown) =>
      n === null || (typeof n === "number" && Number.isSafeInteger(n) && n > 0);
    return (
      positive(item.km) &&
      positive(item.months) &&
      (item.km !== null || item.months !== null)
    );
  });
}

/** Whole calendar months, clamped to month-end like PostgreSQL date + interval. */
export function addCalendarMonths(
  value: unknown,
  months: number,
): string | null {
  const date = validDate(value);
  if (!date || !Number.isSafeInteger(months) || months < 0) return null;
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  if (target.getUTCFullYear() > 9999) return null;
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function nextScheduleMilestone({
  milestones,
  recurrenceKm,
  recurrenceMonths,
  completedMilestone,
  inServiceDate,
  calendarAnchorMode,
  lastServiceDate,
}: {
  milestones: unknown;
  recurrenceKm?: number | null;
  recurrenceMonths?: number | null;
  completedMilestone?: number | null;
  inServiceDate?: unknown;
  calendarAnchorMode?: "in_service" | "last_service";
  lastServiceDate?: unknown;
}) {
  const stages = scheduleMilestones(milestones);
  if (!stages.length) return null;
  const replacementMonths = relativeReplacementMonths({
    milestones,
    recurrenceKm,
    recurrenceMonths,
    calendarAnchorMode,
  });
  if (replacementMonths !== null && validDate(lastServiceDate)) {
    return {
      nextMilestone:
        completedMilestone != null &&
        Number.isSafeInteger(completedMilestone) &&
        completedMilestone >= 0
          ? completedMilestone + 1
          : null,
      dueKm: null,
      dueMonths: replacementMonths,
      dueDate: addCalendarMonths(lastServiceDate, replacementMonths),
    };
  }
  if (
    completedMilestone == null ||
    !Number.isSafeInteger(completedMilestone) ||
    completedMilestone < 0
  )
    return { nextMilestone: null, dueKm: null, dueMonths: null, dueDate: null };
  const ordinal = completedMilestone + 1;
  const fixed = stages[ordinal - 1];
  const repeat = ordinal - stages.length;
  const last = stages[stages.length - 1];
  const dueKm = fixed
    ? fixed.km
    : recurrenceKm != null && recurrenceKm > 0 && last.km !== null
      ? last.km + recurrenceKm * repeat
      : null;
  const replacementClock =
    calendarAnchorMode === "last_service" && completedMilestone > 0;
  const dueMonths = replacementClock
    ? (recurrenceMonths ?? null)
    : fixed
      ? fixed.months
      : recurrenceMonths != null && recurrenceMonths > 0 && last.months !== null
        ? last.months + recurrenceMonths * repeat
        : null;
  return {
    nextMilestone: ordinal,
    dueKm,
    dueMonths,
    dueDate:
      dueMonths === null
        ? null
        : addCalendarMonths(
            replacementClock ? lastServiceDate : inServiceDate,
            dueMonths,
          ),
  };
}

/** Concrete occurrences of THIS item; these are not global booklet review numbers. */
export function maintenanceOccurrenceOptions({
  milestones,
  recurrenceKm,
  recurrenceMonths,
  currentKm = 0,
  knownOrdinal,
  inServiceDate,
}: {
  milestones: unknown;
  recurrenceKm?: number | null;
  recurrenceMonths?: number | null;
  currentKm?: number;
  knownOrdinal?: number | null;
  inServiceDate?: unknown;
}) {
  const stages = scheduleMilestones(milestones);
  if (!stages.length) return [];
  const mileageCount =
    recurrenceKm && recurrenceKm > 0
      ? Math.ceil(currentKm / recurrenceKm) + stages.length + 2
      : 0;
  const start = validDate(inServiceDate);
  const now = new Date();
  const ageMonths = start
    ? Math.max(
        0,
        (now.getUTCFullYear() - Number(start.slice(0, 4))) * 12 +
          now.getUTCMonth() +
          1 -
          Number(start.slice(5, 7)),
      )
    : 0;
  const ageCount =
    recurrenceMonths && recurrenceMonths > 0
      ? Math.ceil(ageMonths / recurrenceMonths) + stages.length + 2
      : 0;
  const count = Math.min(
    10_000,
    Math.max(12, mileageCount, ageCount, (knownOrdinal ?? 0) + 3),
  );
  return Array.from({ length: count }, (_, index) => {
    const result = nextScheduleMilestone({
      milestones,
      recurrenceKm,
      recurrenceMonths,
      completedMilestone: index,
    });
    return {
      ordinal: index + 1,
      km: result?.dueKm ?? null,
      months: result?.dueMonths ?? null,
    };
  });
}
