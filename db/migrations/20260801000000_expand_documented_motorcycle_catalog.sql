-- Expand onboarding beyond exact schedules without weakening their meaning.
-- Every selectable template below has an official manufacturer source. A
-- template remains `is_exact_schedule = false` unless its maintenance table
-- was verified for that exact year, generation and variant.

alter table public.motorcycle_templates
  add column if not exists is_catalog_visible boolean not null default false;

create index if not exists motorcycle_templates_visible_catalog_idx
  on public.motorcycle_templates(brand, model, year_from desc, variant)
  where is_catalog_visible = true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'motorcycle_templates_visible_finite_range'
      and conrelid = 'public.motorcycle_templates'::regclass
  ) then
    alter table public.motorcycle_templates
      add constraint motorcycle_templates_visible_finite_range
      check (not is_catalog_visible or year_to is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'motorcycle_templates_exact_single_year'
      and conrelid = 'public.motorcycle_templates'::regclass
  ) then
    alter table public.motorcycle_templates
      add constraint motorcycle_templates_exact_single_year
      check (not is_exact_schedule or (year_to is not null and year_to = year_from));
  end if;
end $$;

update public.motorcycle_templates
set is_catalog_visible = true, updated_at = now()
where id between '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd001'
  and '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012';

insert into public.motorcycle_templates
  (id, brand, model, year_from, year_to, variant, generation, engine_cc, country_code, is_exact_schedule, is_catalog_visible)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd020', 'Dafra', 'NH 190', 2025, 2026, 'Trail', 'Modelo 2025 em diante', 183, 'BR', false, true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd021', 'Dafra', 'NHX 190', 2025, 2026, 'Street', 'Manual jan. 2025', 183, 'BR', false, true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd022', 'Dafra', 'NH 300', 2025, 2026, 'Trail', 'Modelo 2025 em diante', 278, 'BR', false, true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd023', 'Dafra', 'Cruisym 150', 2025, 2026, 'Scooter', 'Modelo 2025 em diante', 150, 'BR', false, true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd030', 'Shineray', 'Jet 50S', 2023, 2024, 'Ciclomotor', 'Manual revisado em 2024', 49, 'BR', false, true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd031', 'Shineray', 'SHI 175', 2022, 2023, 'Street carburada', 'Manual copyright 2022', 174, 'BR', false, true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd032', 'Shineray', 'SHI 175S EFI', 2024, 2025, 'Street EFI', 'Manual 2025 rev. 003', 174, 'BR', false, true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd033', 'Shineray', 'Free 150 EFI', 2024, 2025, 'Street', 'Manual 2025 rev. 00', 149, 'BR', false, true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd040', 'KTM', '200 Duke', 2017, 2026, 'Naked', 'Modelos 2017 em diante', 200, 'BR', false, true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd041', 'KTM', '390 Duke', 2017, 2026, 'Naked', 'Modelos 2017 em diante', 390, 'BR', false, true)
on conflict (id) do update set
  brand = excluded.brand, model = excluded.model, year_from = excluded.year_from,
  year_to = excluded.year_to, variant = excluded.variant,
  generation = excluded.generation, engine_cc = excluded.engine_cc,
  country_code = excluded.country_code,
  is_exact_schedule = excluded.is_exact_schedule,
  is_catalog_visible = excluded.is_catalog_visible, updated_at = now();

-- The original Honda and Yamaha family templates already have official
-- document records and starter plans. Giving them auditable source metadata
-- makes them available alongside exact schedules while preserving the exact
-- flag on the two verified CG 160 Start years.
insert into public.motorcycle_manual_sources
  (id, template_id, official_url, document_version, page_reference, last_verified_date, coverage_notes)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd201', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd001', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Catálogo oficial Honda — CG 150/160', 'Selecione modelo, versão e ano no catálogo', date '2026-08-01', 'Documento oficial por ano. O plano inicial do Moto Track é orientativo até o PDF exato ser selecionado.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd202', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd002', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Catálogo oficial Honda — Biz 125', 'Selecione modelo, versão e ano no catálogo', date '2026-08-01', 'Documento oficial por ano. Confirme intervalos e especificações no PDF da versão escolhida.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd203', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd003', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Catálogo oficial Honda — Pop 100/110i', 'Selecione modelo, versão e ano no catálogo', date '2026-08-01', 'Documento oficial por ano. Confirme intervalos e especificações no PDF da versão escolhida.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd204', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd004', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Catálogo oficial Honda — NXR Bros 150/160', 'Selecione modelo, versão e ano no catálogo', date '2026-08-01', 'Documento oficial por ano. Confirme intervalos e especificações no PDF da versão escolhida.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd205', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd005', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Catálogo oficial Honda — XRE 300', 'Selecione modelo, versão e ano no catálogo', date '2026-08-01', 'Documento oficial por ano. Confirme intervalos e especificações no PDF da versão escolhida.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd206', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd006', 'https://www.honda.com.br/pos-venda/motos/manual-e-guia', 'Catálogo oficial Honda — PCX 150/160', 'Selecione modelo, versão e ano no catálogo', date '2026-08-01', 'Documento oficial por ano. Confirme os itens da transmissão CVT no PDF da versão escolhida.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd207', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd007', 'https://www.yamaha-motor.com.br/manuais-e-catalogos', 'Catálogo oficial Yamaha — Factor 125/150', 'Selecione o manual do proprietário por modelo e ano', date '2026-08-01', 'A Yamaha publica PDFs por modelo/ano. O plano inicial é orientativo até a seleção do documento exato.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd208', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd008', 'https://www.yamaha-motor.com.br/manuais-e-catalogos', 'Catálogo oficial Yamaha — Fazer 250/FZ25', 'Selecione o manual do proprietário por modelo e ano', date '2026-08-01', 'A Yamaha publica PDFs por modelo/ano. Confirme a geração e os intervalos no documento escolhido.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd209', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd009', 'https://www.yamaha-motor.com.br/manuais-e-catalogos', 'Catálogo oficial Yamaha — Crosser 150', 'Selecione o manual do proprietário por modelo e ano', date '2026-08-01', 'A Yamaha publica PDFs por modelo/ano. Confirme a versão S/Z e os intervalos no documento escolhido.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd210', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd010', 'https://www.yamaha-motor.com.br/manuais-e-catalogos', 'Catálogo oficial Yamaha — Lander 250', 'Selecione o manual do proprietário por modelo e ano', date '2026-08-01', 'A Yamaha publica PDFs por modelo/ano. Confirme a geração e os intervalos no documento escolhido.')
on conflict (template_id) do update set
  official_url = excluded.official_url,
  document_version = excluded.document_version,
  page_reference = excluded.page_reference,
  last_verified_date = excluded.last_verified_date,
  coverage_notes = excluded.coverage_notes,
  updated_at = now();

insert into public.motorcycle_manual_sources
  (id, template_id, official_url, document_version, page_reference, last_verified_date, coverage_notes)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd220', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd020', 'https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nh-190-modelo-2025-em-diante--jan-25.pdf', 'Manual do proprietário Dafra — NH 190 modelo 2025+', 'Programa de manutenção preventiva no manual', date '2026-08-01', 'Manual oficial para NH 190 modelo 2025 em diante; catálogo verificado até o modelo 2026.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd221', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd021', 'https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nhx-190--jan-25.pdf', 'Manual do proprietário Dafra — NHX 190, jan. 2025', 'Programa de manutenção preventiva no manual', date '2026-08-01', 'Documento e catálogo oficiais comprovam os modelos 2025 e 2026.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd222', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd022', 'https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-nh-300-modelo-2025-em-diante--jan-25.pdf', 'Manual do proprietário Dafra — NH 300 modelo 2025+', 'Programa de manutenção preventiva no manual', date '2026-08-01', 'Manual oficial para NH 300 modelo 2025 em diante; catálogo verificado até o modelo 2026.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd223', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd023', 'https://daframotos.com.br/documentos/pos-vendas-dafra-motos-manual-proprietario-cruisym-150-2025-em-diante.pdf', 'Manual do proprietário Dafra — Cruisym 150 modelo 2025+', 'Programa de manutenção preventiva, p. 71–73', date '2026-08-01', 'Manual oficial para Cruisym 150 modelo 2025 em diante; catálogo verificado até o modelo 2026.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd230', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd030', 'https://www.shineray.com.br/wp-content/uploads/2024/04/MANUAL-DE-PROPRIETARIO-JET50S.pdf', 'Manual do proprietário Shineray — Jet 50S, revisão 2024', 'Tabela de manutenção periódica no PDF oficial', date '2026-08-01', 'Cobertura documental comprovada para publicações 2023–2024; não implica produção contínua fora desse período.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd231', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd031', 'https://www.shineray.com.br/wp-content/uploads/2024/03/MANUAL-DE-PROPRIETARIO-SHI-175-2.pdf', 'Manual do proprietário Shineray — SHI 175', 'Tabela de manutenção periódica no PDF oficial', date '2026-08-01', 'Cobertura documental da versão carburada comprovada para 2022–2023.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd232', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd032', 'https://www.shineray.com.br/wp-content/uploads/2024/06/2025-MANUAL-DE-PROPRIETARIO-SHI-175S-EFI-REV003.pdf', 'Manual do proprietário Shineray — SHI 175S EFI 2025 rev. 003', 'Tabela de manutenção periódica no PDF oficial', date '2026-08-01', 'Cobertura documental da versão EFI comprovada para as publicações 2024–2025.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd233', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd033', 'https://www.shineray.com.br/wp-content/uploads/2024/05/2025-MANUAL-DE-PROPRIETARIO-FREE-150-EFI-REV00.pdf', 'Manual do proprietário Shineray — Free 150 EFI 2025 rev. 00', 'Tabela de manutenção periódica no PDF oficial', date '2026-08-01', 'Cobertura documental comprovada para as publicações 2024–2025.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd240', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd040', 'https://www.ktm.com/pt-br/service/manuals.html', 'Portal oficial KTM — 200 Duke', 'Filtre 200 Duke pelo ano-modelo 2017 ou posterior', date '2026-08-01', 'A KTM publica documentos por VIN/modelo e ano. O portal oficial é a autoridade; não reutilize intervalos entre gerações sem conferir o manual selecionado.'),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd241', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd041', 'https://www.ktm.com/pt-br/service/manuals.html', 'Portal oficial KTM — 390 Duke', 'Filtre 390 Duke pelo ano-modelo 2017 ou posterior', date '2026-08-01', 'A KTM publica documentos por VIN/modelo e ano. O portal oficial é a autoridade; não reutilize intervalos entre gerações sem conferir o manual selecionado.')
on conflict (template_id) do update set
  official_url = excluded.official_url,
  document_version = excluded.document_version,
  page_reference = excluded.page_reference,
  last_verified_date = excluded.last_verified_date,
  coverage_notes = excluded.coverage_notes,
  updated_at = now();

insert into public.motorcycle_template_specs
  (template_id, fuel_type_recommendation, oil_type_recommendation, oil_viscosity_recommendation, manual_url)
select t.id, 'Consulte o documento oficial do ano', 'Consulte o documento oficial do ano',
  'Consulte o documento oficial do ano', ms.official_url
from public.motorcycle_templates t
join public.motorcycle_manual_sources ms on ms.template_id = t.id
where t.id in (
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd020', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd021',
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd022', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd023',
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd030',
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd031', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd032',
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd033', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd040',
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd041'
)
on conflict (template_id) do update set
  fuel_type_recommendation = excluded.fuel_type_recommendation,
  oil_type_recommendation = excluded.oil_type_recommendation,
  oil_viscosity_recommendation = excluded.oil_viscosity_recommendation,
  manual_url = excluded.manual_url,
  updated_at = now();

insert into public.motorcycle_template_documents
  (template_id, title, document_type, external_url, source_url, notes)
select ms.template_id, ms.document_version,
  case
    when ms.document_version like 'Programa de manutenção%' then 'maintenance_program'
    when ms.document_version like 'Catálogo%' or ms.document_version like 'Portal%' then 'manual_catalog'
    else 'owner_manual'
  end,
  ms.official_url, ms.official_url, ms.coverage_notes
from public.motorcycle_manual_sources ms
where ms.template_id in (
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd020', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd021',
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd022', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd023',
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd030',
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd031', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd032',
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd033', '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd040',
  '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd041'
)
on conflict (template_id, title) do update set
  document_type = excluded.document_type,
  external_url = excluded.external_url,
  source_url = excluded.source_url,
  notes = excluded.notes,
  updated_at = now();

-- Existing family-level starter items become auditable without being promoted
-- to exact schedules. Their notes already tell riders to confirm the year PDF.
update public.motorcycle_template_maintenance_items mi
set manual_source_id = ms.id, updated_at = now()
from public.motorcycle_manual_sources ms
where ms.template_id = mi.template_id
  and mi.manual_source_id is null
  and mi.template_id between '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd001'
    and '0f0bb40e-0aec-4b09-a3f0-2ddc3cafd010';

create or replace function public.validate_motorcycle_catalog_selection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.year <= 1900 or new.year > extract(year from current_date)::integer then
    raise exception 'Ano da moto fora do intervalo permitido.'
      using errcode = '23514';
  end if;

  if new.source_template_id is not null and not exists (
    select 1
    from public.motorcycle_templates t
    join public.motorcycle_manual_sources ms on ms.template_id = t.id
    where t.id = new.source_template_id
      and t.is_catalog_visible = true
      and new.year between t.year_from and t.year_to
  ) then
    raise exception 'Modelo ou ano não disponível no catálogo documentado.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists motorcycles_validate_catalog_selection
  on public.motorcycles;
create trigger motorcycles_validate_catalog_selection
  before insert or update of source_template_id, year on public.motorcycles
  for each row execute function public.validate_motorcycle_catalog_selection();
