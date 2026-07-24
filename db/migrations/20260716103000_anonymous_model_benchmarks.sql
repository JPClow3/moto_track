create table public.anonymous_model_benchmark_contributions (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  consumption_km_l numeric(8,2),
  maintenance_cents integer not null default 0 check (maintenance_cents >= 0),
  created_at timestamptz not null default now()
);

create index anonymous_model_benchmark_cohort_idx
  on public.anonymous_model_benchmark_contributions (model_key, created_at desc);

-- NOTE (Neon migration): the original migration enabled RLS here and added
-- an "Anyone can contribute a benchmark sample" insert policy open to
-- anon/authenticated. No RLS/anon/authenticated on Neon, so both were
-- dropped; any authenticated app request can insert a contribution row via
-- app-layer SQL instead (this table has no owner_id — contributions are
-- intentionally anonymous, matching the original policy's intent).

create function public.model_benchmark_summary(p_model_key text)
returns table(sample_size integer, average_consumption_km_l numeric, average_maintenance_cents numeric)
language sql stable security definer set search_path = public
as $$
  select count(*)::integer, round(avg(consumption_km_l), 2), round(avg(maintenance_cents), 0)
  from public.anonymous_model_benchmark_contributions
  where model_key = p_model_key
  having count(*) >= 5
$$;

-- `security definer` + the pure-SQL body have no auth.uid()/auth.users
-- dependency (it's a plain aggregate with a k-anonymity floor), so the
-- function itself is kept as-is. The `grant execute ... to authenticated`
-- below was dropped (role doesn't exist on Neon); the app's DB role already
-- has EXECUTE by default ownership, so no replacement grant is needed.
revoke all on function public.model_benchmark_summary(text) from public;
