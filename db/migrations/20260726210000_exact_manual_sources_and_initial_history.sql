-- A schedule is only publishable when it points to a source that can be
-- inspected. Family-level templates remain available to existing owners, but
-- new catalogue choices are limited to exact year/generation/variant entries.
alter table public.motorcycle_templates
  add column if not exists generation text not null default '',
  add column if not exists is_exact_schedule boolean not null default false;

create table if not exists public.motorcycle_manual_sources (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.motorcycle_templates(id) on delete cascade,
  official_url text not null,
  document_version text not null,
  page_reference text not null,
  last_verified_date date not null,
  coverage_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id)
);

alter table public.motorcycle_template_maintenance_items
  add column if not exists manual_source_id uuid references public.motorcycle_manual_sources(id) on delete set null,
  add column if not exists estimated_cost_cents integer not null default 0
    check (estimated_cost_cents >= 0);

alter table public.maintenance_plan_items
  add column if not exists manual_source_id uuid references public.motorcycle_manual_sources(id) on delete set null,
  add column if not exists estimated_cost_cents integer not null default 0
    check (estimated_cost_cents >= 0),
  add column if not exists initial_history_status text not null default 'unknown'
    check (initial_history_status in ('confirmed_done', 'not_done', 'unknown'));

create index if not exists motorcycle_manual_sources_template_idx
  on public.motorcycle_manual_sources(template_id);
create index if not exists maintenance_plan_due_source_idx
  on public.maintenance_plan_items(owner_id, motorcycle_id, initial_history_status)
  where is_active = true;

-- The former entries intentionally remain false: they describe families, not
-- one defensible schedule. They are retained for motorcycles already linked to
-- them rather than silently changing an owner's source history.
update public.motorcycle_templates set is_exact_schedule = false
where is_exact_schedule is distinct from false;

-- Initial verified schedule: Honda CG 160 Start, model year 2019, second
-- generation. The direct Honda PDF has a full maintenance table on pages
-- 32-34; source values below are transcribed only from that table.
insert into public.motorcycle_templates
  (id, brand, model, year_from, year_to, variant, generation, engine_cc, country_code, is_exact_schedule)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011', 'Honda', 'CG 160', 2019, 2019, 'Start', 'Não indicada no manual', 160, 'BR', true)
on conflict (id) do update set
  brand = excluded.brand, model = excluded.model, year_from = excluded.year_from,
  year_to = excluded.year_to, variant = excluded.variant, generation = excluded.generation,
  engine_cc = excluded.engine_cc, country_code = excluded.country_code,
  is_exact_schedule = excluded.is_exact_schedule, updated_at = now();

insert into public.motorcycle_template_specs
  (template_id, fuel_tank_capacity_l, fuel_type_recommendation, oil_capacity_l,
   oil_type_recommendation, oil_viscosity_recommendation, manual_url)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011', 14.60, 'Gasolina', 1.00,
   'Óleo genuíno Honda ou equivalente JASO MA', 'SAE 10W-30, API SL ou superior',
   'https://www.honda.com.br/pos-venda/sites/customer_service_motos/files/manuais/MP%20CG%20160%20START%20%282019%29%20D2203-MAN-1186_WEB.pdf')
on conflict (template_id) do update set
  fuel_tank_capacity_l = excluded.fuel_tank_capacity_l,
  fuel_type_recommendation = excluded.fuel_type_recommendation,
  oil_capacity_l = excluded.oil_capacity_l,
  oil_type_recommendation = excluded.oil_type_recommendation,
  oil_viscosity_recommendation = excluded.oil_viscosity_recommendation,
  manual_url = excluded.manual_url, updated_at = now();

insert into public.motorcycle_manual_sources
  (id, template_id, official_url, document_version, page_reference, last_verified_date, coverage_notes)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd101',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011',
   'https://www.honda.com.br/pos-venda/sites/customer_service_motos/files/manuais/MP%20CG%20160%20START%20%282019%29%20D2203-MAN-1186_WEB.pdf',
   'D2203-MAN-1186_WEB · CG 160 Start 2019',
   'Tabela de manutenção, p. 32–34 (PDF p. 49–51)',
   date '2026-07-26',
   'Cobre somente Honda CG 160 Start, ano-modelo 2019, uso normal. O PDF não identifica a geração; confirme pelo ano/modelo no chassi. Uso severo exige intervalo mais curto conforme o manual.')
on conflict (template_id) do update set
  official_url = excluded.official_url, document_version = excluded.document_version,
  page_reference = excluded.page_reference, last_verified_date = excluded.last_verified_date,
  coverage_notes = excluded.coverage_notes, updated_at = now();

insert into public.motorcycle_template_documents
  (template_id, title, document_type, external_url, source_url, notes)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011', 'Manual do proprietário — CG 160 Start 2019', 'owner_manual',
   'https://www.honda.com.br/pos-venda/sites/customer_service_motos/files/manuais/MP%20CG%20160%20START%20%282019%29%20D2203-MAN-1186_WEB.pdf',
   'https://www.honda.com.br/pos-venda/sites/customer_service_motos/files/manuais/MP%20CG%20160%20START%20%282019%29%20D2203-MAN-1186_WEB.pdf',
   'Fonte oficial D2203-MAN-1186_WEB; tabela de manutenção nas páginas 32–34.')
on conflict (template_id, title) do update set
  external_url = excluded.external_url, source_url = excluded.source_url,
  notes = excluded.notes, updated_at = now();

insert into public.motorcycle_template_maintenance_items
  (template_id, maintenance_type, interval_km, interval_days, notes, source_url, manual_source_id, estimated_cost_cents)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011', 'Corrente de transmissão', 1000, null,
   'Verificar, ajustar e lubrificar.',
   'https://www.honda.com.br/pos-venda/sites/customer_service_motos/files/manuais/MP%20CG%20160%20START%20%282019%29%20D2203-MAN-1186_WEB.pdf',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd101', 4000),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011', 'Óleo do motor', 6000, null,
   'Trocar; verifique o nível antes de pilotar.',
   'https://www.honda.com.br/pos-venda/sites/customer_service_motos/files/manuais/MP%20CG%20160%20START%20%282019%29%20D2203-MAN-1186_WEB.pdf',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd101', 11000),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011', 'Freios e pneus', 6000, null,
   'Inspecionar sistema de freio, rodas e pneus.',
   'https://www.honda.com.br/pos-venda/sites/customer_service_motos/files/manuais/MP%20CG%20160%20START%20%282019%29%20D2203-MAN-1186_WEB.pdf',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd101', 5000),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011', 'Vela de ignição', 12000, null,
   'Verificar e trocar conforme a tabela de manutenção.',
   'https://www.honda.com.br/pos-venda/sites/customer_service_motos/files/manuais/MP%20CG%20160%20START%20%282019%29%20D2203-MAN-1186_WEB.pdf',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd101', 6000),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011', 'Filtro de ar', 18000, null,
   'Substituir o filtro de ar úmido (tipo viscoso).',
   'https://www.honda.com.br/pos-venda/sites/customer_service_motos/files/manuais/MP%20CG%20160%20START%20%282019%29%20D2203-MAN-1186_WEB.pdf',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd101', 8000)
on conflict (template_id, maintenance_type) do update set
  interval_km = excluded.interval_km, interval_days = excluded.interval_days,
  notes = excluded.notes, source_url = excluded.source_url,
  manual_source_id = excluded.manual_source_id,
  estimated_cost_cents = excluded.estimated_cost_cents, updated_at = now();
