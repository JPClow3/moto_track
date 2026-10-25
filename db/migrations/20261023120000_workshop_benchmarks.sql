-- Account/record metadata stays separate from owner-free labor observations.
-- Cascading from both account and source record to guard and then observation
-- guarantees withdrawal and deletion remove the anonymous observation too.
create table public.workshop_benchmark_submission_guards (
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  record_id uuid not null references public.maintenance_records(id) on delete cascade,
  contribution_id uuid not null default gen_random_uuid() unique,
  source_workshop text not null,
  source_service text not null,
  serviced_on date not null,
  source_total_cents integer not null check (source_total_cents > 0),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, record_id)
);

create table public.anonymous_workshop_benchmark_contributions (
  id uuid primary key references public.workshop_benchmark_submission_guards(contribution_id) on delete cascade,
  workshop_key text not null check (length(workshop_key) between 2 and 120),
  workshop_name text not null check (length(workshop_name) between 2 and 120),
  service_key text not null check (length(service_key) between 2 and 120),
  city_key text not null check (length(city_key) between 2 and 120),
  city_name text not null check (length(city_name) between 2 and 120),
  state_code text not null check (state_code in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  )),
  labor_cents integer not null check (labor_cents > 0 and labor_cents <= 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workshop_benchmark_region_service_idx
  on public.anonymous_workshop_benchmark_contributions (state_code, city_key, service_key, workshop_key);

-- Never expose raw prices, contributor IDs, or even individual dates. Changed
-- source records are excluded until the rider explicitly reviews and consents
-- again. All repeats from an account are averaged first, so one frequent rider
-- cannot satisfy the privacy floor or outweigh four other accounts.
create function public.workshop_benchmark_summary(p_service_key text, p_city_key text, p_state_code text)
returns table(workshop_key text, workshop_name text, sample_size integer, average_labor_cents numeric)
language sql stable security definer set search_path = public
as $$
  with per_account as (
    select c.workshop_key, min(c.workshop_name) as workshop_name,
      g.owner_id, avg(c.labor_cents) as average_labor_cents
    from anonymous_workshop_benchmark_contributions c
    join workshop_benchmark_submission_guards g on g.contribution_id = c.id
    join maintenance_records r on r.id = g.record_id and r.owner_id = g.owner_id
    where c.service_key = p_service_key and c.city_key = p_city_key
      and c.state_code = p_state_code
      and r.workshop = g.source_workshop and r.maintenance_type = g.source_service
      and r.date = g.serviced_on and r.cost_cents = g.source_total_cents
      and r.currency = 'BRL' and r.date <= current_date
      and c.labor_cents <= r.cost_cents
    group by c.workshop_key, g.owner_id
  )
  select p.workshop_key, min(p.workshop_name), count(distinct p.owner_id)::integer,
    round(avg(p.average_labor_cents), 0)
  from per_account p
  group by p.workshop_key
  having count(distinct p.owner_id) >= 5
  order by round(avg(p.average_labor_cents), 0), min(p.workshop_name)
  limit 50
$$;

revoke all on function public.workshop_benchmark_summary(text, text, text) from public;
