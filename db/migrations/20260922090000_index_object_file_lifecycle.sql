-- Object cleanup always resolves metadata by owner and polymorphic source.
-- Keep account/source deletion from scanning every user's upload inventory.
create index if not exists object_files_owner_source_idx
  on public.object_files (owner_id, source_table, source_id);

-- R2 is external to Postgres, so deleting application metadata cannot be made
-- atomic with deleting the object itself. This durable queue is deliberately
-- not foreign-keyed to neon_auth.user: account deletion must remove the user
-- while retaining pending physical cleanup work for the cron worker.
create table if not exists public.object_deletion_queue (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  object_key text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, object_key),
  check (object_key like owner_id::text || '/%')
);

create index if not exists object_deletion_queue_due_idx
  on public.object_deletion_queue (next_attempt_at, created_at);

-- Keep a minimal, non-PII provider tombstone after the auth-user cascade so
-- late Stripe cancellation webhooks become successful no-ops instead of
-- repeatedly attempting to recreate a profile for a deleted owner.
create table if not exists public.account_deletion_tombstones (
  owner_id uuid primary key,
  stripe_customer_id text not null default '',
  stripe_subscription_id text not null default '',
  deleted_at timestamptz not null default now()
);

create index if not exists account_deletion_tombstones_customer_idx
  on public.account_deletion_tombstones (stripe_customer_id)
  where stripe_customer_id <> '';

create index if not exists account_deletion_tombstones_subscription_idx
  on public.account_deletion_tombstones (stripe_subscription_id)
  where stripe_subscription_id <> '';

-- Webhook idempotency only needs the event id/type and processing status.
-- Historical raw Stripe payloads can contain customer contact data and must
-- not outlive an account without an owner relationship.
update public.billing_events
set payload = '{}'::jsonb
where payload <> '{}'::jsonb;

alter table public.billing_events
  alter column payload set default '{}'::jsonb;
