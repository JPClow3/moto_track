create table public.anonymous_model_benchmark_contributions (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  consumption_km_l numeric(8,2),
  maintenance_cents integer not null default 0 check (maintenance_cents >= 0),
  created_at timestamptz not null default now()
);

create index anonymous_model_benchmark_cohort_idx
  on public.anonymous_model_benchmark_contributions (model_key, created_at desc);

alter table public.anonymous_model_benchmark_contributions enable row level security;

create function public.model_benchmark_summary(p_model_key text)
returns table(sample_size integer, average_consumption_km_l numeric, average_maintenance_cents numeric)
language sql stable security definer set search_path = public
as $$
  select count(*)::integer, round(avg(consumption_km_l), 2), round(avg(maintenance_cents), 0)
  from public.anonymous_model_benchmark_contributions
  where model_key = p_model_key
  having count(*) >= 5
$$;

revoke all on function public.model_benchmark_summary(text) from public;
grant execute on function public.model_benchmark_summary(text) to authenticated;
