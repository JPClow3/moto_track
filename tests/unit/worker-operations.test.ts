import { describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import { getWorkerOperationsSummary } from "../../src/lib/server/domain/worker-operations";

describe("staff worker operations summary", () => {
  it("returns only bounded run history and aggregate deletion backlog", async () => {
    const dbMock = vi.fn((strings: TemplateStringsArray) => {
      const query = strings.join(" ").replaceAll(/\s+/g, " ");
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

    await expect(getWorkerOperationsSummary(db)).resolves.toMatchObject({
      available: true,
      recentRuns: [{ status: "succeeded", failure_codes: [] }],
      deletionBacklog: {
        queued: 3,
        due_now: 2,
        oldest_item_age_seconds: 7200,
      },
    });
    expect(dbMock).toHaveBeenCalledTimes(2);
    expect(
      dbMock.mock.calls.map(([query]) => query.join(" ")).join(" "),
    ).not.toContain("owner_id");
  });

  it("keeps the staff console usable when operational tables are unavailable", async () => {
    const db = vi.fn(() => Promise.reject(new Error("table unavailable")));

    await expect(
      getWorkerOperationsSummary(db as unknown as Sql),
    ).resolves.toEqual({
      available: false,
      recentRuns: [],
      deletionBacklog: null,
    });
  });
});
