-- Curated Brazilian catalogue.  These are model families that consistently
-- appear among the country's best-selling motorcycles over the last twenty
-- years.  Manuals stay on the manufacturers' official sites: they are
-- copyrighted works and must not be mirrored by the application.

create table public.motorcycle_template_documents (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.motorcycle_templates(id) on delete cascade,
  title text not null,
  document_type text not null default 'owner_manual',
  external_url text not null,
  source_url text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, title)
);

create table public.motorcycle_template_maintenance_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.motorcycle_templates(id) on delete cascade,
  maintenance_type text not null,
  interval_km integer check (interval_km is null or interval_km > 0),
  interval_days integer check (interval_days is null or interval_days > 0),
  notes text not null default '',
  source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (interval_km is not null or interval_days is not null),
  unique (template_id, maintenance_type)
);

create index motorcycle_template_documents_template_idx
  on public.motorcycle_template_documents(template_id);
create index motorcycle_template_maintenance_template_idx
  on public.motorcycle_template_maintenance_items(template_id);

-- Stable UUIDs make the inserts idempotent and allow a repeatable seed.
insert into public.motorcycle_templates
  (id, brand, model, year_from, year_to, variant, engine_cc, country_code)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd001', 'Honda', 'CG 150 / CG 160', 2006, 2026, 'Família de vendas BR', 160, 'BR'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd002', 'Honda', 'Biz 125', 2006, 2026, 'Família de vendas BR', 125, 'BR'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd003', 'Honda', 'Pop 100 / Pop 110i', 2006, 2026, 'Família de vendas BR', 110, 'BR'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd004', 'Honda', 'NXR Bros 150 / 160', 2006, 2026, 'Família de vendas BR', 160, 'BR'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd005', 'Honda', 'XRE 300', 2009, 2026, 'Família de vendas BR', 300, 'BR'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd006', 'Honda', 'PCX 150 / 160', 2013, 2026, 'Família de vendas BR', 160, 'BR'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd007', 'Yamaha', 'Factor 125 / 150', 2009, 2026, 'Família de vendas BR', 150, 'BR'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd008', 'Yamaha', 'Fazer 250', 2006, 2026, 'Família de vendas BR', 250, 'BR'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd009', 'Yamaha', 'Crosser 150', 2014, 2026, 'Família de vendas BR', 150, 'BR'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd010', 'Yamaha', 'Lander 250', 2006, 2026, 'Família de vendas BR', 250, 'BR')
on conflict (id) do update set
  brand = excluded.brand, model = excluded.model, year_from = excluded.year_from,
  year_to = excluded.year_to, variant = excluded.variant, engine_cc = excluded.engine_cc,
  updated_at = now();

-- Technical fields are intentionally family-level.  The owner manual selected
-- for the exact model year remains the authority whenever a generation differs.
insert into public.motorcycle_template_specs
  (template_id, fuel_type_recommendation, manual_url, oil_type_recommendation, oil_viscosity_recommendation)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd001', 'Gasolina ou etanol conforme o ano/versão', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Óleo para motocicleta', 'Consulte o manual do ano'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd002', 'Gasolina ou etanol conforme o ano/versão', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Óleo para motocicleta/scooter', 'Consulte o manual do ano'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd003', 'Gasolina conforme o ano/versão', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Óleo para motocicleta', 'Consulte o manual do ano'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd004', 'Gasolina ou etanol conforme o ano/versão', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Óleo para motocicleta', 'Consulte o manual do ano'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd005', 'Gasolina ou etanol conforme o ano/versão', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Óleo para motocicleta', 'Consulte o manual do ano'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd006', 'Gasolina conforme o ano/versão', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Óleo para scooter', 'Consulte o manual do ano'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd007', 'Gasolina ou etanol conforme o ano/versão', 'https://www.yamaha-motor.com.br/manuais-e-catalogos', 'Yamalube ou equivalente homologado', 'Consulte o manual do ano'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd008', 'Gasolina ou etanol conforme o ano/versão', 'https://www.yamaha-motor.com.br/manuais-e-catalogos', 'Yamalube ou equivalente homologado', 'Consulte o manual do ano'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd009', 'Gasolina ou etanol conforme o ano/versão', 'https://www.yamaha-motor.com.br/manuais-e-catalogos', 'Yamalube ou equivalente homologado', 'Consulte o manual do ano'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd010', 'Gasolina ou etanol conforme o ano/versão', 'https://www.yamaha-motor.com.br/manuais-e-catalogos', 'Yamalube ou equivalente homologado', 'Consulte o manual do ano')
on conflict (template_id) do update set
  fuel_type_recommendation = excluded.fuel_type_recommendation,
  manual_url = excluded.manual_url,
  oil_type_recommendation = excluded.oil_type_recommendation,
  oil_viscosity_recommendation = excluded.oil_viscosity_recommendation,
  updated_at = now();

insert into public.motorcycle_template_documents
  (template_id, title, document_type, external_url, source_url, notes)
select id, 'Manual do proprietário (PDF oficial)', 'owner_manual',
  case when brand = 'Honda' then 'https://www.honda.com.br/pos-venda/motos/manual-e-guia'
       else 'https://www.yamaha-motor.com.br/manuais-e-catalogos' end,
  case when brand = 'Honda' then 'https://www.honda.com.br/pos-venda/motos/manual-e-guia'
       else 'https://www.yamaha-motor.com.br/manuais-e-catalogos' end,
  'Abra o catálogo oficial e escolha o modelo e ano exatos antes de baixar o PDF.'
from public.motorcycle_templates
where id between '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd001' and '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd010'
on conflict (template_id, title) do update set
  external_url = excluded.external_url, source_url = excluded.source_url,
  notes = excluded.notes, updated_at = now();

-- Conservative, editable reminders.  Exact torque, fluid and shorter severe-
-- use intervals are deliberately left to the owner's model-year PDF.
insert into public.motorcycle_template_maintenance_items
  (template_id, maintenance_type, interval_km, interval_days, notes, source_url)
select id, item.maintenance_type, item.interval_km, item.interval_days, item.notes,
  case when t.brand = 'Honda' then 'https://www.honda.com.br/pos-venda/motos/manual-e-guia'
       else 'https://www.yamaha-motor.com.br/manuais-e-catalogos' end
from public.motorcycle_templates t
cross join (values
  ('Inspeção de segurança', 1000, 30, 'Pneus, freios, luzes e vazamentos. Antecipe em uso severo.'),
  ('Revisão periódica', 6000, 365, 'Intervalo inicial do catálogo; confirme a tabela do manual do ano.'),
  ('Óleo do motor', 6000, 365, 'Use a viscosidade e o intervalo do manual do ano/versão.'),
  ('Filtro de ar', 12000, 365, 'Inspecione e antecipe a substituição em poeira intensa.'),
  ('Freios e pneus', 6000, 365, 'Inspeção de desgaste e calibragem conforme manual.')
) as item(maintenance_type, interval_km, interval_days, notes)
where t.id between '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd001' and '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd010'
on conflict (template_id, maintenance_type) do update set
  interval_km = excluded.interval_km, interval_days = excluded.interval_days,
  notes = excluded.notes, source_url = excluded.source_url, updated_at = now();

-- Scooters use a CVT rather than a drive chain; add its inspectable service
-- reminder without pretending it applies to the conventional motorcycles.
insert into public.motorcycle_template_maintenance_items
  (template_id, maintenance_type, interval_km, interval_days, notes, source_url)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd006', 'Transmissão CVT', 12000, 365,
   'Inspecione correia, roletes e carcaça; confirme a troca pelo manual do ano.',
   'https://www.honda.com.br/pos-venda/motos/manual-e-guia')
on conflict (template_id, maintenance_type) do update set
  interval_km = excluded.interval_km, interval_days = excluded.interval_days,
  notes = excluded.notes, source_url = excluded.source_url, updated_at = now();
