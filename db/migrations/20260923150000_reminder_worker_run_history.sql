-- Minimal, non-PII execution history for the scheduled reminder and object
-- deletion worker. Keep counts nullable when a task did not complete.
create table if not exists public.reminder_worker_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null check (trigger_source in ('scheduled', 'manual')),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  reminders_due integer check (reminders_due >= 0),
  reminders_emailed integer check (reminders_emailed >= 0),
  reminders_pushed integer check (reminders_pushed >= 0),
  reminders_email_failed integer check (reminders_email_failed >= 0),
  reminders_push_failed integer check (reminders_push_failed >= 0),
  deletions_attempted integer check (deletions_attempted >= 0),
  deletions_succeeded integer check (deletions_succeeded >= 0),
  deletions_failed integer check (deletions_failed >= 0),
  failure_codes text[] not null default '{}',
  check (
    failure_codes <@ array[
      'reminders_task_failed',
      'object_deletions_task_failed',
      'email_delivery_failed',
      'push_delivery_failed',
      'object_deletion_failed',
      'worker_execution_failed'
    ]::text[]
  ),
  check (
    (status = 'running' and finished_at is null)
    or (status in ('succeeded', 'failed') and finished_at is not null)
  )
);

create index if not exists reminder_worker_runs_started_at_idx
  on public.reminder_worker_runs (started_at desc);
