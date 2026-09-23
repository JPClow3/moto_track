import type { Sql } from "postgres";

export type ReminderWorkerRunSummary = {
  started_at: string;
  finished_at: string | null;
  status: "running" | "succeeded" | "failed";
  trigger_source: "scheduled" | "manual";
  reminders_due: number | null;
  reminders_emailed: number | null;
  reminders_pushed: number | null;
  deletions_attempted: number | null;
  deletions_succeeded: number | null;
  deletions_failed: number | null;
  failure_codes: string[];
};

export type ObjectDeletionBacklogSummary = {
  queued: number;
  due_now: number;
  oldest_item_age_seconds: number | null;
  highest_attempt_count: number | null;
};

export type ScheduledRunSummary = Pick<
  ReminderWorkerRunSummary,
  "started_at" | "status"
>;

export type WorkerOperationsSummary = {
  available: boolean;
  recentRuns: ReminderWorkerRunSummary[];
  latestScheduledRun: ScheduledRunSummary | null;
  expectedLatestScheduledSlotAt: string;
  latestScheduledSlotRecorded: boolean;
  deletionBacklog: ObjectDeletionBacklogSummary | null;
};

/** The reminders Worker runs daily at 08:00 UTC. This is a reference slot,
 * not an alert deadline or tolerance window. */
export function expectedLatestScheduledSlotAt(now: Date) {
  const slot = new Date(now);
  slot.setUTCHours(8, 0, 0, 0);
  if (now.getTime() < slot.getTime()) {
    slot.setUTCDate(slot.getUTCDate() - 1);
  }
  return slot.toISOString();
}

/**
 * Loads non-PII operational aggregates for the staff console. This is strictly
 * read-only: never expose account/object identifiers or last_error contents.
 */
export async function getWorkerOperationsSummary(
  sql: Sql,
  now = new Date(),
): Promise<WorkerOperationsSummary> {
  try {
    const [recentRuns, [latestScheduledRun], [deletionBacklog]] =
      await Promise.all([
        sql<ReminderWorkerRunSummary[]>`
        select started_at::text, finished_at::text, status, trigger_source,
          reminders_due, reminders_emailed, reminders_pushed,
          deletions_attempted, deletions_succeeded, deletions_failed,
          failure_codes
        from reminder_worker_runs
        order by started_at desc
        limit 10
      `,
        sql<ScheduledRunSummary[]>`
        select started_at::text, status
        from reminder_worker_runs
        where trigger_source = 'scheduled'
        order by started_at desc
        limit 1
      `,
        sql<ObjectDeletionBacklogSummary[]>`
        select
          count(*)::int as queued,
          count(*) filter (where next_attempt_at <= now())::int as due_now,
          extract(epoch from max(now() - created_at))::int
            as oldest_item_age_seconds,
          max(attempt_count)::int as highest_attempt_count
        from object_deletion_queue
      `,
      ]);

    const expectedSlot = expectedLatestScheduledSlotAt(now);
    const latestScheduledSlotRecorded =
      latestScheduledRun !== undefined &&
      Number.isFinite(Date.parse(latestScheduledRun.started_at)) &&
      Date.parse(latestScheduledRun.started_at) >= Date.parse(expectedSlot);

    return {
      available: true,
      recentRuns,
      latestScheduledRun: latestScheduledRun ?? null,
      expectedLatestScheduledSlotAt: expectedSlot,
      latestScheduledSlotRecorded,
      deletionBacklog: deletionBacklog ?? {
        queued: 0,
        due_now: 0,
        oldest_item_age_seconds: null,
        highest_attempt_count: null,
      },
    };
  } catch {
    // Keep the rest of the admin console available if an operational table is
    // missing or temporarily unreachable; render an explicit unavailable state.
    return {
      available: false,
      recentRuns: [],
      latestScheduledRun: null,
      expectedLatestScheduledSlotAt: expectedLatestScheduledSlotAt(now),
      latestScheduledSlotRecorded: false,
      deletionBacklog: null,
    };
  }
}
