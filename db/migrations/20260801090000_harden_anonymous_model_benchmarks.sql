-- Keep account-level deduplication metadata separate from the anonymous
-- benchmark rows. The benchmark table itself still has no owner_id (or any
-- other account identifier), while this guard lets the app safely upsert one
-- contribution per account/model without exposing ownership in cohort output.
create table if not exists public.model_benchmark_submission_guards (
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  model_key text not null,
  contribution_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, model_key),
  unique (contribution_id)
);

create index if not exists model_benchmark_submission_guards_model_idx
  on public.model_benchmark_submission_guards (model_key);

-- Older rows used zero as a placeholder. New contributions use NULL when the
-- rider has no comparable maintenance history so that the cohort average does
-- not silently treat missing history as zero cost.
alter table public.anonymous_model_benchmark_contributions
  alter column maintenance_cents drop not null;

alter table public.anonymous_model_benchmark_contributions
  alter column maintenance_cents drop default;

alter table public.anonymous_model_benchmark_contributions
  add column if not exists updated_at timestamptz not null default now();

alter table public.anonymous_model_benchmark_contributions
  drop constraint if exists anonymous_model_benchmark_contributions_consumption_km_l_check;

alter table public.anonymous_model_benchmark_contributions
  add constraint anonymous_model_benchmark_contributions_consumption_km_l_check
  check (consumption_km_l is null or (consumption_km_l >= 1 and consumption_km_l <= 100));

alter table public.anonymous_model_benchmark_contributions
  drop constraint if exists anonymous_model_benchmark_contributions_maintenance_cents_check;

alter table public.anonymous_model_benchmark_contributions
  add constraint anonymous_model_benchmark_contributions_maintenance_cents_check
  check (maintenance_cents is null or (maintenance_cents >= 0 and maintenance_cents <= 1000000));

alter table public.anonymous_model_benchmark_contributions
  drop constraint if exists anonymous_model_benchmark_contributions_has_metric_check;

alter table public.anonymous_model_benchmark_contributions
  add constraint anonymous_model_benchmark_contributions_has_metric_check
  check (consumption_km_l is not null or maintenance_cents is not null);

-- Return the cohort size even while it is below the privacy floor, but apply
-- the k-anonymity floor independently to each metric. A cohort can contain
-- five riders while only one of them has a usable consumption history; that
-- one rider must not be exposed through an average.
drop function if exists public.model_benchmark_summary(text);

create function public.model_benchmark_summary(p_model_key text)
returns table(
  sample_size integer,
  consumption_sample_size integer,
  average_consumption_km_l numeric,
  maintenance_sample_size integer,
  average_maintenance_cents numeric
)
language sql stable security definer set search_path = public
as $$
  select
    count(distinct g.owner_id)::integer,
    count(distinct g.owner_id) filter (
      where c.consumption_km_l is not null
    )::integer,
    case when count(distinct g.owner_id) filter (
      where c.consumption_km_l is not null
    ) >= 5
      then round(avg(c.consumption_km_l), 2)
      else null end,
    count(distinct g.owner_id) filter (
      where c.maintenance_cents is not null
    )::integer,
    case when count(distinct g.owner_id) filter (
      where c.maintenance_cents is not null
    ) >= 5
      then round(avg(c.maintenance_cents), 0)
      else null end
  from public.anonymous_model_benchmark_contributions c
  join public.model_benchmark_submission_guards g
    on g.contribution_id = c.id
   and g.model_key = c.model_key
  where c.model_key = p_model_key
$$;

revoke all on function public.model_benchmark_summary(text) from public;
