import { dueStateForPlan, initialHistoryStatus } from "./motorcycle-catalog";

import { appToday } from "../../utils/calendar-day";
type Row = Record<string, unknown>;

export type DueNowConfidence = "confirmed" | "reported_not_done" | "unknown";

export type DueNowItem = {
  id: string;
  motorcycleId: string;
  motorcycleName: string;
  maintenanceType: string;
  urgency: "overdue" | "due_now";
  /**
   * Separate from `urgency` on purpose. An item is "overdue" both when a
   * confirmed service passed its interval and when the rider told us it was
   * never done — the first has a milestone behind it, the second is a stated
   * fact with no odometer to measure from. Collapsing them would present a
   * guess with the same weight as a measurement.
   */
  confidence: DueNowConfidence;
  dueKm: number | null;
  estimatedCostCents: number;
  officialUrl: string;
  documentVersion: string;
  pageReference: string;
};

const URGENCY_RANK = { overdue: 0, due_now: 1, scheduled: 2 } as const;

function confidenceFor(status: string): DueNowConfidence {
  const normalised = initialHistoryStatus(status);
  if (normalised === "confirmed_done") return "confirmed";
  if (normalised === "not_done") return "reported_not_done";
  return "unknown";
}

/**
 * Turns active plan rows into the dashboard's attention list.
 *
 * The cap is spread across motorcycles instead of taken from a single sorted
 * list: one neglected bike with six overdue items would otherwise fill every
 * slot and hide that a second bike needs attention too. Each bike surfaces its
 * most urgent item before any bike surfaces its second.
 */
/** Garage-wide "due now" list length. */
export const DUE_NOW_LIMIT = 5;

export function buildDueNow({
  rows,
  odometerByMotorcycle,
  limit = DUE_NOW_LIMIT,
  today = appToday(),
}: {
  rows: Row[];
  odometerByMotorcycle: Map<string, number>;
  limit?: number;
  today?: string;
}): DueNowItem[] {
  const byMotorcycle = new Map<string, DueNowItem[]>();

  for (const row of rows) {
    const motorcycleId = String(row.motorcycle_id ?? "");
    const historyStatus = String(row.initial_history_status ?? "unknown");
    const state = dueStateForPlan({
      historyStatus: initialHistoryStatus(historyStatus),
      lastDoneKm: row.last_done_km == null ? null : Number(row.last_done_km),
      intervalKm: row.interval_km == null ? null : Number(row.interval_km),
      intervalDays:
        row.interval_days == null ? null : Number(row.interval_days),
      lastDoneDate: row.last_done_date,
      today,
      scheduleMilestones: row.schedule_milestones,
      recurrenceKm:
        row.recurrence_km == null ? null : Number(row.recurrence_km),
      recurrenceMonths:
        row.recurrence_months == null ? null : Number(row.recurrence_months),
      lastCompletedMilestone:
        row.last_completed_milestone == null
          ? null
          : Number(row.last_completed_milestone),
      inServiceDate: row.in_service_date,
      calendarAnchorMode:
        row.calendar_anchor_mode === "last_service"
          ? "last_service"
          : "in_service",
      currentKm: odometerByMotorcycle.get(motorcycleId) ?? 0,
    });
    if (state.urgency === "scheduled") continue;

    const item: DueNowItem = {
      id: String(row.id),
      motorcycleId,
      motorcycleName: String(row.motorcycle_name ?? "Moto"),
      maintenanceType: String(row.maintenance_type ?? "Manutenção"),
      urgency: state.urgency,
      confidence: confidenceFor(historyStatus),
      dueKm: state.dueKm,
      estimatedCostCents: Number(row.estimated_cost_cents ?? 0),
      officialUrl: String(row.official_url ?? ""),
      documentVersion: String(row.document_version ?? ""),
      pageReference: String(row.page_reference ?? ""),
    };
    byMotorcycle.set(motorcycleId, [
      ...(byMotorcycle.get(motorcycleId) ?? []),
      item,
    ]);
  }

  const queues = [...byMotorcycle.values()].map((items) =>
    [...items].sort(
      (a, b) =>
        URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
        a.maintenanceType.localeCompare(b.maintenanceType),
    ),
  );
  // Bikes with the most urgent single item get served first within each round.
  queues.sort(
    (a, b) =>
      URGENCY_RANK[a[0].urgency] - URGENCY_RANK[b[0].urgency] ||
      a[0].motorcycleName.localeCompare(b[0].motorcycleName),
  );

  const picked: DueNowItem[] = [];
  const depth = Math.max(0, ...queues.map((queue) => queue.length));
  for (let round = 0; round < depth && picked.length < limit; round += 1) {
    for (const queue of queues) {
      if (picked.length >= limit) break;
      const item = queue[round];
      if (item) picked.push(item);
    }
  }
  return picked;
}

export type AttentionReminder = {
  id: string;
  title: string;
  /** Null for a reminder that is not tied to one motorcycle (e.g. a licence). */
  motorcycleId: string | null;
  motorcycleName: string;
  status: "overdue" | "due_soon" | "ok" | "unknown";
  remainingKm: number | null;
  remainingDays: number | null;
};

/**
 * overdue → red, due → amber. "confirm" is a plan item that is only "due"
 * because the rider could not say when it was last done: it is a question,
 * not a warning, so it renders neutral and sorts after real due items.
 */
export type AttentionTone = "overdue" | "due" | "confirm";

export type AttentionItem = {
  kind: "maintenance" | "reminder";
  id: string;
  title: string;
  motorcycleId: string | null;
  motorcycleName: string;
  tone: AttentionTone;
  dueKm: number | null;
  remainingKm: number | null;
  remainingDays: number | null;
  confidence: DueNowConfidence | null;
  estimatedCostCents: number;
  officialUrl: string;
  documentVersion: string;
  pageReference: string;
  href: string;
};

const TONE_RANK = { overdue: 0, due: 1, confirm: 2 } as const;
const KIND_RANK = { maintenance: 0, reminder: 1 } as const;

const nullLast = (value: number | null) =>
  value === null ? Number.POSITIVE_INFINITY : value;

/**
 * Merges plan items and reminders into one list, most urgent first.
 *
 * Only a measured or reported overdue is "overdue"; a plan item that merely
 * reached its milestone, or a reminder inside its warning window, is "due".
 * Within a tone, plan items lead (they carry the manual reference), then the
 * closest by km, then by days.
 */
export function rankAttention({
  dueNow,
  reminders,
}: {
  dueNow: DueNowItem[];
  reminders: AttentionReminder[];
}): AttentionItem[] {
  const items: AttentionItem[] = [
    ...dueNow.map((item): AttentionItem => ({
      kind: "maintenance",
      id: item.id,
      title: item.maintenanceType,
      motorcycleId: item.motorcycleId,
      motorcycleName: item.motorcycleName,
      tone:
        item.urgency === "overdue"
          ? "overdue"
          : item.confidence === "unknown" && item.dueKm === null
            ? "confirm"
            : "due",
      dueKm: item.dueKm,
      remainingKm: null,
      remainingDays: null,
      confidence: item.confidence,
      estimatedCostCents: item.estimatedCostCents,
      officialUrl: item.officialUrl,
      documentVersion: item.documentVersion,
      pageReference: item.pageReference,
      // ?bike= switches the shell's active bike (see the (app) layout), so
      // the bike-scoped maintenance page shows this item, not another bike's.
      href: `/maintenance?bike=${encodeURIComponent(item.motorcycleId)}`,
    })),
    ...reminders
      .filter(
        (reminder) =>
          reminder.status === "overdue" || reminder.status === "due_soon",
      )
      .map((reminder): AttentionItem => ({
        kind: "reminder",
        id: reminder.id,
        title: reminder.title,
        motorcycleId: reminder.motorcycleId,
        motorcycleName: reminder.motorcycleName,
        tone: reminder.status === "overdue" ? "overdue" : "due",
        dueKm: null,
        remainingKm: reminder.remainingKm,
        remainingDays: reminder.remainingDays,
        confidence: null,
        estimatedCostCents: 0,
        officialUrl: "",
        documentVersion: "",
        pageReference: "",
        href: "/reminders",
      })),
  ];

  return items.sort(
    (a, b) =>
      TONE_RANK[a.tone] - TONE_RANK[b.tone] ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      nullLast(a.remainingKm) - nullLast(b.remainingKm) ||
      nullLast(a.remainingDays) - nullLast(b.remainingDays) ||
      a.title.localeCompare(b.title),
  );
}

/**
 * The one item the bike home leads with: the most urgent item for that
 * motorcycle, or for no motorcycle in particular. Null means all is well.
 */
export function mostUrgentFor(
  items: AttentionItem[],
  motorcycleId: string,
): AttentionItem | null {
  return (
    items.find(
      (item) =>
        item.motorcycleId === motorcycleId || item.motorcycleId === null,
    ) ?? null
  );
}
