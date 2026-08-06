import { dueStateForPlan, initialHistoryStatus } from "./motorcycle-catalog";

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
export function buildDueNow({
  rows,
  odometerByMotorcycle,
  limit = 5,
}: {
  rows: Row[];
  odometerByMotorcycle: Map<string, number>;
  limit?: number;
}): DueNowItem[] {
  const byMotorcycle = new Map<string, DueNowItem[]>();

  for (const row of rows) {
    const motorcycleId = String(row.motorcycle_id ?? "");
    const historyStatus = String(row.initial_history_status ?? "unknown");
    const state = dueStateForPlan({
      historyStatus: initialHistoryStatus(historyStatus),
      lastDoneKm: row.last_done_km == null ? null : Number(row.last_done_km),
      intervalKm: row.interval_km == null ? null : Number(row.interval_km),
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
