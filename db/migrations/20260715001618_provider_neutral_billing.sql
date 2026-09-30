-- This bridge deliberately sorts immediately after the initial schema. The
-- migration runner tracks filenames, not checksums, so already-applied files
-- are not replayed. Fresh installs use neutral columns in the initial schema;
-- existing installations pass through this transaction before later pending
-- entitlement migrations can refer to the new columns.
--
-- Previous provider IDs are historical records, never Dodo resource IDs.
-- This migration REFUSES a cutover with potentially billable legacy accounts.
-- First reconcile them with the former provider: cancel/stop renewal and
-- establish an explicit paid-through grace period, or import and verify each
-- subscription at Dodo outside this migration. Do not mark a former provider
-- ID as Dodo. No payment methods or recurring mandates are transferred here.
-- If this gate fails, the runner rolls back this whole file and preserves the
-- old schema, entitlement, references, and history for operator reconciliation.

do $$
declare
  mapping record;
  source_column text;
  candidate_count integer;
  event_constraint text;
  column_constraint record;
  legacy_profiles boolean := false;
  legacy_events boolean := false;
  legacy_tombstones boolean := false;
begin
  -- Discover the former provider namespace from stable resource suffixes,
  -- rather than depending on a particular former provider's column prefix.
  for mapping in
    select * from (values
      ('subscription_profiles', 'billing_customer_id', '_customer_id'),
      ('subscription_profiles', 'billing_subscription_id', '_subscription_id'),
      ('subscription_profiles', 'billing_subscription_status', '_subscription_status'),
      ('subscription_profiles', 'billing_product_id', '_price_id'),
      ('billing_events', 'billing_event_id', '_event_id'),
      ('account_deletion_tombstones', 'billing_customer_id', '_customer_id'),
      ('account_deletion_tombstones', 'billing_subscription_id', '_subscription_id')
    ) as columns_to_migrate(table_name, target_name, resource_suffix)
  loop
    if to_regclass('public.' || mapping.table_name) is null then
      continue;
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = mapping.table_name
        and column_name = mapping.target_name
    ) then
      continue;
    end if;
    select count(*), min(column_name) into candidate_count, source_column
    from information_schema.columns
    where table_schema = 'public' and table_name = mapping.table_name
      and right(column_name, length(mapping.resource_suffix)) = mapping.resource_suffix;
    if candidate_count <> 1 then
      raise exception 'Cannot safely identify %.%: found % former columns',
        mapping.table_name, mapping.target_name, candidate_count;
    end if;
    execute format('alter table public.%I rename column %I to %I',
      mapping.table_name, source_column, mapping.target_name);
    legacy_profiles := legacy_profiles or mapping.table_name = 'subscription_profiles';
    legacy_events := legacy_events or mapping.table_name = 'billing_events';
    legacy_tombstones := legacy_tombstones or mapping.table_name = 'account_deletion_tombstones';
  end loop;

  alter table public.subscription_profiles
    add column if not exists billing_provider text not null default 'dodo'
      check (billing_provider in ('dodo', 'legacy')),
    add column if not exists billing_environment text
      check (billing_environment in ('test_mode', 'live_mode')),
    add column if not exists billing_checkout_session_id text not null default '',
    add column if not exists billing_checkout_url text not null default '',
    add column if not exists billing_checkout_created_at timestamptz;
  alter table public.billing_events
    add column if not exists billing_provider text not null default 'dodo'
      check (billing_provider in ('dodo', 'legacy'));

  if legacy_profiles then
    update public.subscription_profiles set billing_provider = 'legacy'
    where billing_customer_id <> '' or billing_subscription_id <> ''
      or billing_product_id <> '' or billing_subscription_status <> '';
  end if;
  if legacy_events then
    update public.billing_events set billing_provider = 'legacy';
  end if;
  -- Column renaming preserves the unique constraint's former generated name.
  -- Rename that constraint (and its backing index) to match the new column.
  select constraint_record.conname into event_constraint
  from pg_constraint constraint_record
  where constraint_record.conrelid = 'public.billing_events'::regclass
    and constraint_record.contype = 'u'
    and pg_get_constraintdef(constraint_record.oid) = 'UNIQUE (billing_event_id)';
  if event_constraint is not null and event_constraint <> 'billing_events_billing_event_id_key' then
    execute format('alter table public.billing_events rename constraint %I to billing_events_billing_event_id_key',
      event_constraint);
  end if;

  if exists (
    select 1 from public.subscription_profiles
    where billing_provider = 'legacy'
      and (billing_subscription_id <> '' or billing_subscription_status <> '')
      and (
        billing_subscription_status not in ('canceled', 'cancelled', 'incomplete_expired', 'expired', 'failed')
        or (current_period_end > now() and not cancel_at_period_end)
      )
  ) then
    raise exception 'Billing migration blocked: unresolved legacy subscriptions. Verify cancellation/import and preserve paid-through grace before cutover; no IDs can be reused at Dodo.';
  end if;

  -- Preserve already-paid access with a bounded grace period while the user
  -- establishes a new recurring mandate. Canceled legacy IDs remain available
  -- for audit and are explicitly excluded from all Dodo requests.
  update public.subscription_profiles
  set grace_until = greatest(grace_until, current_period_end)
  where billing_provider = 'legacy' and plan = 'pro' and current_period_end > now();

  if to_regclass('public.account_deletion_tombstones') is not null then
    alter table public.account_deletion_tombstones
      add column if not exists billing_provider text not null default 'dodo'
        check (billing_provider in ('dodo', 'legacy')),
      add column if not exists billing_environment text
        check (billing_environment in ('test_mode', 'live_mode'));
    if legacy_tombstones then
      update public.account_deletion_tombstones set billing_provider = 'legacy';
    end if;
  end if;

  -- PostgreSQL 18 also records named NOT NULL constraints. Their names do not
  -- follow column renames automatically, so finish the namespace migration.
  for column_constraint in
    select constraint_record.conname, relation.relname, attribute.attname
    from pg_constraint constraint_record
    join pg_class relation on relation.oid = constraint_record.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    join pg_attribute attribute on attribute.attrelid = relation.oid
      and attribute.attnum = constraint_record.conkey[1]
    where namespace.nspname = 'public' and constraint_record.contype = 'n'
      and relation.relname in ('subscription_profiles', 'billing_events', 'account_deletion_tombstones')
      and left(attribute.attname, 8) = 'billing_'
      and constraint_record.conname <> relation.relname || '_' || attribute.attname || '_not_null'
  loop
    execute format('alter table public.%I rename constraint %I to %I',
      column_constraint.relname, column_constraint.conname,
      column_constraint.relname || '_' || column_constraint.attname || '_not_null');
  end loop;
end;
$$;

-- SQL-language functions retain their original source after column renames.
-- Rebuild the database guard when it already exists on upgraded installations.
do $$
begin
  if to_regprocedure('public.owner_has_pro_access(uuid)') is not null then
    execute $function$
      create or replace function public.owner_has_pro_access(p_owner uuid)
      returns boolean language sql stable security definer set search_path = public
      as $body$
        select exists (
          select 1 from public.subscription_profiles sp
          where sp.owner_id = p_owner and sp.plan = 'pro'
            and (sp.billing_subscription_status in ('active', 'trialing')
              or (sp.grace_until is not null and sp.grace_until >= now()))
        );
      $body$;
    $function$;
  end if;
end;
$$;
