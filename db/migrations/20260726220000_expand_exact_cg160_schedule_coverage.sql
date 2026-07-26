-- Sources are maintained records; keep their verification metadata current
-- whenever an operator corrects an URL, version, page reference or coverage.
drop trigger if exists motorcycle_manual_sources_set_updated_at
  on public.motorcycle_manual_sources;
create trigger motorcycle_manual_sources_set_updated_at
  before update on public.motorcycle_manual_sources
  for each row execute function public.set_updated_at();

-- Do not invent a generation label when the primary source does not provide
-- one. Year and variant remain exact, while coverage notes tell the rider how
-- to resolve a chassis-level ambiguity.
update public.motorcycle_templates
set generation = 'Não indicada no manual'
where id = '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011';
update public.motorcycle_manual_sources
set coverage_notes = 'Cobre somente Honda CG 160 Start, ano-modelo 2019, uso normal. A Honda não identifica a geração neste manual; confirme pelo chassi quando houver dúvida.'
where id = '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd101';

-- This is deliberately a second schedule, not a widened 2018–2019 range.
-- The records may look similar today, but each year keeps its own official
-- document, version and page citation so a later model-year difference cannot
-- silently inherit a neighboring year's consumables or interval.
insert into public.motorcycle_templates
  (id, brand, model, year_from, year_to, variant, generation, engine_cc, country_code, is_exact_schedule)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012', 'Honda', 'CG 160', 2018, 2018, 'Start', 'Não indicada no manual', 160, 'BR', true)
on conflict (id) do update set
  brand = excluded.brand, model = excluded.model, year_from = excluded.year_from,
  year_to = excluded.year_to, variant = excluded.variant, generation = excluded.generation,
  engine_cc = excluded.engine_cc, country_code = excluded.country_code,
  is_exact_schedule = excluded.is_exact_schedule, updated_at = now();

insert into public.motorcycle_template_specs
  (template_id, fuel_tank_capacity_l, fuel_type_recommendation, oil_capacity_l,
   oil_type_recommendation, oil_viscosity_recommendation, manual_url)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012', 14.60, 'Gasolina comum', 1.00,
   'Óleo genuíno Honda ou equivalente JASO MA', 'SAE 10W-30, API SL ou superior',
   'https://www.honda.com.br/pos-venda/motos/sites/customer_service_motos/files/manuais/MP%20CG160%20START%20%282018%29%20D2203-MAN-1109%20Completo.pdf')
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
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd102',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012',
   'https://www.honda.com.br/pos-venda/motos/sites/customer_service_motos/files/manuais/MP%20CG160%20START%20%282018%29%20D2203-MAN-1109%20Completo.pdf',
   'D2203-MAN-1109 · CG 160 Start 2018',
   'Tabela de manutenção, p. 30–32 (PDF p. 47–49)',
   date '2026-07-26',
   'Cobre somente Honda CG 160 Start, ano-modelo 2018, uso normal. A Honda não identifica a geração neste manual; confirme pelo chassi quando houver dúvida.')
on conflict (template_id) do update set
  official_url = excluded.official_url, document_version = excluded.document_version,
  page_reference = excluded.page_reference, last_verified_date = excluded.last_verified_date,
  coverage_notes = excluded.coverage_notes, updated_at = now();

insert into public.motorcycle_template_documents
  (template_id, title, document_type, external_url, source_url, notes)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012', 'Manual do proprietário — CG 160 Start 2018', 'owner_manual',
   'https://www.honda.com.br/pos-venda/motos/sites/customer_service_motos/files/manuais/MP%20CG160%20START%20%282018%29%20D2203-MAN-1109%20Completo.pdf',
   'https://www.honda.com.br/pos-venda/motos/sites/customer_service_motos/files/manuais/MP%20CG160%20START%20%282018%29%20D2203-MAN-1109%20Completo.pdf',
   'Fonte oficial D2203-MAN-1109; tabela de manutenção nas páginas 30–32.')
on conflict (template_id, title) do update set
  external_url = excluded.external_url, source_url = excluded.source_url,
  notes = excluded.notes, updated_at = now();

insert into public.motorcycle_template_maintenance_items
  (template_id, maintenance_type, interval_km, interval_days, notes, source_url, manual_source_id, estimated_cost_cents)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012', 'Corrente de transmissão', 1000, null,
   'Verificar, ajustar e lubrificar.',
   'https://www.honda.com.br/pos-venda/motos/sites/customer_service_motos/files/manuais/MP%20CG160%20START%20%282018%29%20D2203-MAN-1109%20Completo.pdf',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd102', 4000),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012', 'Óleo do motor', 6000, null,
   'Trocar; verifique o nível antes de pilotar.',
   'https://www.honda.com.br/pos-venda/motos/sites/customer_service_motos/files/manuais/MP%20CG160%20START%20%282018%29%20D2203-MAN-1109%20Completo.pdf',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd102', 11000),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012', 'Freios e pneus', 6000, null,
   'Inspecionar sistema de freio, rodas e pneus.',
   'https://www.honda.com.br/pos-venda/motos/sites/customer_service_motos/files/manuais/MP%20CG160%20START%20%282018%29%20D2203-MAN-1109%20Completo.pdf',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd102', 5000),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012', 'Vela de ignição', 12000, null,
   'Verificar e trocar conforme a tabela de manutenção.',
   'https://www.honda.com.br/pos-venda/motos/sites/customer_service_motos/files/manuais/MP%20CG160%20START%20%282018%29%20D2203-MAN-1109%20Completo.pdf',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd102', 6000),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012', 'Filtro de ar', 18000, null,
   'Substituir o filtro de ar úmido (tipo viscoso).',
   'https://www.honda.com.br/pos-venda/motos/sites/customer_service_motos/files/manuais/MP%20CG160%20START%20%282018%29%20D2203-MAN-1109%20Completo.pdf',
   '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd102', 8000)
on conflict (template_id, maintenance_type) do update set
  interval_km = excluded.interval_km, interval_days = excluded.interval_days,
  notes = excluded.notes, source_url = excluded.source_url,
  manual_source_id = excluded.manual_source_id,
  estimated_cost_cents = excluded.estimated_cost_cents, updated_at = now();
