# Reminder Worker operations runbook

This runbook covers production checks for scheduled reminders and R2 object cleanup. The Worker is `moto-track-reminders`; its cron is `0 8 * * *` (08:00 UTC daily), with persisted logs/traces enabled. See [`wrangler.toml`](../workers/reminders/wrangler.toml), [`index.ts`](../workers/reminders/index.ts), and the [deployment workflow](../.github/workflows/deploy-reminders.yml).

## Check a scheduled run

1. In Cloudflare Dashboard, open **Workers & Pages → moto-track-reminders → Observability → Logs**. Select the time window around the most recent 08:00 UTC cron and inspect invocation errors/exceptions. The Worker also emits `Reminder email delivery failed.` when the Email binding rejects a send; that message intentionally omits the recipient address. Check the Worker’s **Triggers** settings to confirm the daily cron is still `0 8 * * *`.
2. A completed reminder pass returns aggregate `due`, `emailed`, and `pushed` counts; the deletion pass returns `attempted`, `deleted`, and `failed`. These counts are returned by the optional manual endpoint, not written to a durable application run-history table. Do not treat absence of an email-failure log as proof that every scheduled run succeeded.
3. If the cron is absent or invocations are failing, verify the production Worker’s `HYPERDRIVE` points to the intended Neon database, `R2_BUCKET` is bound to `moto-track-media`, and the Email binding plus `DEFAULT_FROM_EMAIL` are configured. For push delivery, check `PUBLIC_VAPID_KEY`, `VAPID_PRIVATE_KEY`, and `PUSH_ENCRYPTION_KEY`; push is skipped if required configuration is absent. Review the latest deployment in **Workers & Pages → moto-track-reminders → Deployments** and the failed GitHub Actions run for the [Deploy reminder Worker workflow](../.github/workflows/deploy-reminders.yml).

The authenticated Worker fetch endpoint executes the same real reminder and deletion work as cron. It can send real email/push and delete R2 objects. It is disabled (404) unless `REMINDERS_TRIGGER_TOKEN` is set and otherwise requires a matching bearer token (401 on mismatch). Do not use it as a read-only health check or against real users; only invoke it when an explicitly approved production smoke is intended.

## Inspect the object-deletion backlog

Use the Neon SQL Editor connected to the same production database as the Worker’s Hyperdrive binding. Run read-only aggregate queries; avoid selecting `owner_id` or `object_key` into tickets or shared logs because they identify accounts and stored objects.

```sql
-- Overall backlog and age. The daily Worker selects at most 100 due rows per run.
select
  now() as observed_at,
  count(*) as queued,
  count(*) filter (where next_attempt_at <= now()) as due_now,
  count(*) filter (where next_attempt_at > now()) as waiting_for_retry,
  max(now() - created_at) as oldest_item_age,
  max(attempt_count) as highest_attempt_count
from public.object_deletion_queue;

-- Aggregate failure reasons without exposing object keys or owner IDs.
select attempt_count, last_error, count(*) as queued
from public.object_deletion_queue
where attempt_count > 0
group by attempt_count, last_error
order by attempt_count desc, queued desc;
```

These queries require migration `20260922090000_index_object_file_lifecycle.sql`, which creates `public.object_deletion_queue` and its due index. If the table is missing, first verify the migration ledger and apply the repository migration through the established production migration procedure; do not create or edit the table manually.

The Worker processes up to 100 due rows on each daily cron. Failed R2 deletes remain queued, increment `attempt_count`, record a generic `last_error`, and receive exponential retry delay (starting at five minutes, capped at 24 hours). Because the scheduled pass is daily, actual retries normally wait until the next cron even when `next_attempt_at` is earlier. A successful R2 delete removes its queue row. Compare aggregate counts and oldest age across scheduled runs; a persistent or growing due backlog warrants checking R2 binding/availability, Worker exceptions, and Hyperdrive/database connectivity. Do not delete queue rows to make the backlog appear healthy. The next scheduled pass is the normal retry path; if an operator needs to accelerate recovery, follow the existing production-change approval and use only the guarded Worker execution path after verifying its real-send/delete effects.

## Alerting gap

Persisted Worker logs and traces are enabled, but the repository contains no configured alert destination, threshold, notification rule, durable cron-run history, or queue-backlog alarm. Failures therefore require an operator to inspect Cloudflare observability and the Neon aggregate queries above; this runbook does not claim automated alerting.
