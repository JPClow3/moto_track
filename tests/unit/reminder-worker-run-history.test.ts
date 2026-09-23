import { describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import {
  summarizePushAttempt,
  summarizeWorkerTasks,
  trackWorkerRun,
  type ObjectDeletionRunCounts,
  type ReminderRunCounts,
} from "../../workers/reminders/run-history";

function fakeSql() {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  const sql = Object.assign(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("?").replaceAll(/\s+/g, " ").trim();
      calls.push({ query, values });
      if (query.startsWith("insert into reminder_worker_runs")) {
        return [{ id: "run-1" }];
      }
      return [];
    },
    { array: (values: unknown[]) => values },
  ) as unknown as Sql;
  return { sql, calls };
}

const reminderCounts: ReminderRunCounts = {
  due: 4,
  emailed: 2,
  pushed: 1,
  emailFailed: 1,
  pushFailed: 0,
};

const deletionCounts: ObjectDeletionRunCounts = {
  attempted: 3,
  deleted: 2,
  failed: 1,
};

describe("reminder Worker run history", () => {
  it("counts partial push success as a delivered reminder", () => {
    expect(summarizePushAttempt(true, true)).toEqual({
      pushed: 1,
      pushFailed: 0,
    });
    expect(summarizePushAttempt(false, true)).toEqual({
      pushed: 0,
      pushFailed: 1,
    });
    expect(summarizePushAttempt(false, false)).toEqual({
      pushed: 0,
      pushFailed: 0,
    });
  });

  it("records a successful run with aggregate counts and source", async () => {
    const { sql, calls } = fakeSql();
    const result = await trackWorkerRun(sql, "scheduled", async () => ({
      reminders: { ...reminderCounts, emailFailed: 0 },
      objectDeletions: { ...deletionCounts, failed: 0 },
      failures: [],
    }));

    expect(result).toMatchObject({ runId: "run-1", status: "succeeded" });
    expect(calls[0].query).toContain("status = 'running'");
    expect(calls[0].query).toContain("interval '1 hour'");
    expect(calls[1].query).toContain("interval '90 days'");
    expect(calls[2].query).toContain("values (?, 'running')");
    expect(calls[2].values).toEqual(["scheduled"]);
    expect(calls[3].query).toContain("update reminder_worker_runs");
    expect(calls[3].values).toEqual([
      "succeeded",
      4,
      2,
      1,
      0,
      0,
      3,
      2,
      0,
      [],
      "run-1",
    ]);
  });

  it("stores provider and queue failures as safe codes, not raw errors", async () => {
    const { sql, calls } = fakeSql();
    const partial = await trackWorkerRun(sql, "manual", async () => ({
      reminders: reminderCounts,
      objectDeletions: deletionCounts,
      failures: ["email_delivery_failed", "object_deletion_failed"],
    }));

    expect(partial.status).toBe("failed");
    expect(calls[3].values).toContainEqual([
      "email_delivery_failed",
      "object_deletion_failed",
    ]);
    expect(calls[1].values).not.toContain("owner@example.com");
  });

  it("marks thrown work failed without persisting the exception message", async () => {
    const { sql, calls } = fakeSql();
    await expect(
      trackWorkerRun(sql, "scheduled", async () => {
        throw new Error("R2 failure for owner@example.com/object-key");
      }),
    ).rejects.toThrow("R2 failure");

    expect(calls).toHaveLength(4);
    expect(calls[3].query).toContain("status = 'failed'");
    expect(calls[3].values).toEqual([["worker_execution_failed"], "run-1"]);
    expect(JSON.stringify(calls)).not.toContain("owner@example.com");
    expect(JSON.stringify(calls)).not.toContain("object-key");
  });

  it("classifies returned delivery failures and rejected task components", () => {
    expect(
      summarizeWorkerTasks(
        { status: "fulfilled", value: reminderCounts },
        { status: "fulfilled", value: deletionCounts },
      ),
    ).toEqual({
      reminders: reminderCounts,
      objectDeletions: deletionCounts,
      failures: ["email_delivery_failed", "object_deletion_failed"],
    });

    expect(
      summarizeWorkerTasks(
        { status: "rejected", reason: new Error("private provider detail") },
        { status: "fulfilled", value: deletionCounts },
      ),
    ).toEqual({
      reminders: null,
      objectDeletions: deletionCounts,
      failures: ["reminders_task_failed", "object_deletion_failed"],
    });
  });

  it("does not fail a reminder when one subscription succeeds and another fails", () => {
    const partiallyDelivered = {
      ...reminderCounts,
      emailFailed: 0,
      pushed: 1,
      pushFailed: 0,
    };

    expect(
      summarizeWorkerTasks(
        { status: "fulfilled", value: partiallyDelivered },
        { status: "fulfilled", value: { ...deletionCounts, failed: 0 } },
      ).failures,
    ).toEqual([]);
  });

  it("fails a reminder when every push subscription fails", () => {
    const undelivered = {
      ...reminderCounts,
      emailFailed: 0,
      pushed: 0,
      pushFailed: 1,
    };

    expect(
      summarizeWorkerTasks(
        { status: "fulfilled", value: undelivered },
        { status: "fulfilled", value: { ...deletionCounts, failed: 0 } },
      ).failures,
    ).toEqual(["push_delivery_failed"]);
  });
});
