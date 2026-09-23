import { describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import {
  expectedLatestScheduledSlotAt,
  getWorkerOperationsSummary,
} from "../../src/lib/server/domain/worker-operations";

describe("staff worker operations summary", () => {
  it("returns only bounded run history and aggregate deletion backlog", async () => {
    const dbMock = vi.fn((strings: TemplateStringsArray) => {
      const query = strings.join(" ").replaceAll(/\s+/g, " ");
      if (query.includes("where trigger_source = 'scheduled'")) {
        return Promise.resolve([
          {
            started_at: "2026-09-23 08:00:00+00",
            status: "succeeded",
          },
        ]);
      }
      if (query.includes("from reminder_worker_runs")) {
        return Promise.resolve([
          {
            started_at: "2026-09-23 08:00:00+00",
            finished_at: "2026-09-23 08:00:02+00",
            status: "succeeded",
            trigger_source: "scheduled",
            reminders_due: 2,
            reminders_emailed: 2,
            reminders_pushed: 1,
            deletions_attempted: 3,
            deletions_succeeded: 3,
            deletions_failed: 0,
            failure_codes: [],
          },
        ]);
      }
      return Promise.resolve([
        {
          queued: 3,
          due_now: 2,
          oldest_item_age_seconds: 7200,
          highest_attempt_count: 1,
        },
      ]);
    });
    const db = dbMock as unknown as Sql;

    await expect(
      getWorkerOperationsSummary(db, new Date("2026-09-23T12:00:00Z")),
    ).resolves.toMatchObject({
      available: true,
      recentRuns: [{ status: "succeeded", failure_codes: [] }],
      latestScheduledRun: {
        started_at: "2026-09-23 08:00:00+00",
        status: "succeeded",
      },
      expectedLatestScheduledSlotAt: "2026-09-23T08:00:00.000Z",
      latestScheduledSlotRecorded: true,
      deletionBacklog: {
        queued: 3,
        due_now: 2,
        oldest_item_age_seconds: 7200,
      },
    });
    expect(dbMock).toHaveBeenCalledTimes(3);
    expect(
      dbMock.mock.calls.map(([query]) => query.join(" ")).join(" "),
    ).not.toContain("owner_id");
  });

  it("does not let manual runs mask the expected daily scheduled slot", async () => {
    const db = vi.fn((strings: TemplateStringsArray) => {
      const query = strings.join(" ").replaceAll(/\s+/g, " ");
      if (query.includes("where trigger_source = 'scheduled'")) {
        return Promise.resolve([]);
      }
      if (query.includes("from reminder_worker_runs")) {
        return Promise.resolve([
          {
            started_at: "2026-09-23 07:30:00+00",
            finished_at: "2026-09-23 07:30:02+00",
            status: "succeeded",
            trigger_source: "manual",
            reminders_due: 0,
            reminders_emailed: 0,
            reminders_pushed: 0,
            deletions_attempted: 0,
            deletions_succeeded: 0,
            deletions_failed: 0,
            failure_codes: [],
          },
        ]);
      }
      return Promise.resolve([
        {
          queued: 0,
          due_now: 0,
          oldest_item_age_seconds: null,
          highest_attempt_count: null,
        },
      ]);
    });

    await expect(
      getWorkerOperationsSummary(
        db as unknown as Sql,
        new Date("2026-09-23T09:00:00Z"),
      ),
    ).resolves.toMatchObject({
      recentRuns: [{ trigger_source: "manual" }],
      latestScheduledRun: null,
      latestScheduledSlotRecorded: false,
    });
  });

  it("uses the prior UTC cron slot before 08:00 UTC", () => {
    expect(
      expectedLatestScheduledSlotAt(new Date("2026-09-23T07:59:00Z")),
    ).toBe("2026-09-22T08:00:00.000Z");
    expect(
      expectedLatestScheduledSlotAt(new Date("2026-09-23T08:00:00Z")),
    ).toBe("2026-09-23T08:00:00.000Z");
  });

  it("keeps the staff console usable when operational tables are unavailable", async () => {
    const db = vi.fn(() => Promise.reject(new Error("table unavailable")));

    await expect(
      getWorkerOperationsSummary(
        db as unknown as Sql,
        new Date("2026-09-23T09:00:00Z"),
      ),
    ).resolves.toEqual({
      available: false,
      recentRuns: [],
      latestScheduledRun: null,
      expectedLatestScheduledSlotAt: "2026-09-23T08:00:00.000Z",
      latestScheduledSlotRecorded: false,
      deletionBacklog: null,
    });
  });
});
