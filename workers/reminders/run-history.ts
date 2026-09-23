import type { Sql } from "postgres";

export type WorkerRunSource = "scheduled" | "manual";

export type WorkerFailureCode =
  | "reminders_task_failed"
  | "object_deletions_task_failed"
  | "email_delivery_failed"
  | "push_delivery_failed"
  | "object_deletion_failed"
  | "worker_execution_failed";

export type ReminderRunCounts = {
  due: number;
  emailed: number;
  pushed: number;
  emailFailed: number;
  pushFailed: number;
};

export type ObjectDeletionRunCounts = {
  attempted: number;
  deleted: number;
  failed: number;
};

export type WorkerRunOutcome = {
  reminders: ReminderRunCounts | null;
  objectDeletions: ObjectDeletionRunCounts | null;
  failures: WorkerFailureCode[];
};

export type TrackedWorkerRun = WorkerRunOutcome & {
  runId: string;
  status: "succeeded" | "failed";
};

export function summarizeWorkerTasks(
  reminderTask: PromiseSettledResult<ReminderRunCounts>,
  deletionTask: PromiseSettledResult<ObjectDeletionRunCounts>,
): WorkerRunOutcome {
  const reminders =
    reminderTask.status === "fulfilled" ? reminderTask.value : null;
  const objectDeletions =
    deletionTask.status === "fulfilled" ? deletionTask.value : null;
  const failures: WorkerFailureCode[] = [];

  if (reminderTask.status === "rejected") {
    failures.push("reminders_task_failed");
  } else {
    if (reminderTask.value.emailFailed > 0)
      failures.push("email_delivery_failed");
    if (reminderTask.value.pushFailed > 0)
      failures.push("push_delivery_failed");
  }
  if (deletionTask.status === "rejected") {
    failures.push("object_deletions_task_failed");
  } else if (deletionTask.value.failed > 0) {
    failures.push("object_deletion_failed");
  }

  return { reminders, objectDeletions, failures };
}

export async function trackWorkerRun(
  sql: Sql,
  triggerSource: WorkerRunSource,
  work: () => Promise<WorkerRunOutcome>,
): Promise<TrackedWorkerRun> {
  // The Worker runtime cannot finalize history after a hard termination.
  // Reclassify any impossible-to-still-be-running execution before starting
  // the next one, then retain a bounded 90-day operational history.
  await sql`
    update reminder_worker_runs
    set status = 'failed', finished_at = now(),
      failure_codes = ${sql.array(["worker_execution_failed"], 1009)}
    where status = 'running' and started_at < now() - interval '1 hour'
  `;
  await sql`
    delete from reminder_worker_runs
    where finished_at < now() - interval '90 days'
  `;

  const [run] = await sql<Array<{ id: string }>>`
    insert into reminder_worker_runs (trigger_source, status)
    values (${triggerSource}, 'running')
    returning id
  `;
  if (!run) throw new Error("Could not start reminder worker run history.");

  let outcome: WorkerRunOutcome;
  try {
    outcome = await work();
  } catch (cause) {
    await finishFailedRun(sql, run.id, ["worker_execution_failed"]);
    throw cause;
  }

  const status = outcome.failures.length ? "failed" : "succeeded";
  try {
    await sql`
      update reminder_worker_runs
      set status = ${status},
        finished_at = now(),
        reminders_due = ${outcome.reminders?.due ?? null},
        reminders_emailed = ${outcome.reminders?.emailed ?? null},
        reminders_pushed = ${outcome.reminders?.pushed ?? null},
        reminders_email_failed = ${outcome.reminders?.emailFailed ?? null},
        reminders_push_failed = ${outcome.reminders?.pushFailed ?? null},
        deletions_attempted = ${outcome.objectDeletions?.attempted ?? null},
        deletions_succeeded = ${outcome.objectDeletions?.deleted ?? null},
        deletions_failed = ${outcome.objectDeletions?.failed ?? null},
        failure_codes = ${sql.array(outcome.failures, 1009)}
      where id = ${run.id} and status = 'running'
    `;
  } catch (cause) {
    // Make a second best-effort write with a generic code; never persist a raw
    // provider/SQL exception, which could include account or object details.
    await finishFailedRun(sql, run.id, ["worker_execution_failed"]);
    throw cause;
  }

  return { ...outcome, runId: run.id, status };
}

async function finishFailedRun(
  sql: Sql,
  runId: string,
  failureCodes: WorkerFailureCode[],
) {
  await sql`
    update reminder_worker_runs
    set status = 'failed', finished_at = now(),
      failure_codes = ${sql.array(failureCodes, 1009)}
    where id = ${runId} and status = 'running'
  `;
}
