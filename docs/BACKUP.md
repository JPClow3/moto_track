# Backup & Disaster Recovery Runbook

> Addresses audit finding **I-L12** — until now there was no documented backup
> strategy. This is the source-of-truth runbook; keep it up to date when the
> infra changes.

## Scope

Moto Track stores user data in two places:

| Tier | What | Where in prod |
| --- | --- | --- |
| Relational | Users, motorcycles, fuel/maintenance/tire records, billing | PostgreSQL |
| Object | Uploaded files (documents, receipts, maintenance photos) | S3 bucket (`AWS_STORAGE_BUCKET_NAME`) |

Anything in `media/` on the host filesystem (e.g. local dev) is **not** considered
authoritative and is excluded from backups.

## Backup cadence

| Asset | Cadence | Retention | Mechanism |
| --- | --- | --- | --- |
| Postgres logical dump (`pg_dump --format=custom`) | Hourly | 7 days | Cron on the DB host or managed-service snapshot |
| Postgres base backup + WAL | Continuous (WAL archiving) | 14 days | Managed Postgres (or `pgBackRest` self-hosted) |
| S3 bucket | n/a — versioning enabled | Object versioning, 90-day soft-delete | Bucket-level versioning + lifecycle rule |
| Stripe data | Authoritative in Stripe; no local backup needed | n/a | `BillingEvent` table provides local audit trail |

## Operational tasks

### 1. Verify the latest backup (weekly)

```bash
# List most recent dumps
aws s3 ls s3://${BACKUP_BUCKET}/postgres/ --recursive | tail -5
# Restore to a throwaway DB and run sanity queries
pg_restore --clean --if-exists --no-owner -d postgres://... latest.dump
psql -d ... -c "select count(*) from auth_user;"
```

### 2. Restore from latest dump (DR)

1. Provision a new Postgres instance with the same Postgres major version.
2. Download the most recent `pg_dump` artifact from the backup bucket.
3. `pg_restore --clean --if-exists --no-owner -d postgres://... dump.bin`
4. Update `DATABASE_URL` in the app environment to point at the restored DB.
5. Roll the app pod / container; verify with `manage.py check` and a login flow.
6. Communicate window of lost data (= time between last backup and incident).

### 3. Restore an S3 object

```bash
# List versions
aws s3api list-object-versions --bucket ${AWS_STORAGE_BUCKET_NAME} --prefix path/to/file
# Restore by re-copying the desired version on top of itself
aws s3api copy-object --bucket ${AWS_STORAGE_BUCKET_NAME} \
  --copy-source "${AWS_STORAGE_BUCKET_NAME}/path/to/file?versionId=<id>" \
  --key path/to/file
```

### 4. Quarterly restore drill (required)

On the first Monday of every quarter:

1. Spin up a staging DB from the most recent backup.
2. Run the test suite against it (`DATABASE_URL=...staging... pytest -m smoke`).
3. Record drill outcome in `docs/drills.md` (date, RPO observed, issues).

## Recovery objectives

| Metric | Target |
| --- | --- |
| RPO (Recovery Point Objective) | ≤ 1 hour |
| RTO (Recovery Time Objective) | ≤ 4 hours |

If the actual restore time exceeds the RTO target during a drill, file a ticket
to invest in faster restore tooling (parallel restore, PITR, etc.).

## What we don't back up

- Local dev `db.sqlite3` (re-creatable via `python manage.py migrate && manage.py seed_demo_data`)
- Tailwind generated CSS (re-built on deploy)
- Sentry data (Sentry retains per their plan)
- Container images (re-built from source; tags are in the registry)
