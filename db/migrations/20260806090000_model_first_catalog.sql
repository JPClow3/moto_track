-- Model-first catalogue.  Until now the picker listed one entry per
-- `motorcycle_templates` row, so the same motorcycle appeared several times --
-- once as a sales-line row spanning 2006-2026 and once per exact model year --
-- with the year range baked into the label even though the form asks for a
-- year separately.
--
-- `motorcycle_models` makes the model a first-class row: brand + model + variant
-- ("CG 160 Start") identifies it, and `motorcycle_templates` becomes the
-- per-year entry hanging off it.  The picker asks for a model, then a year; the
-- pair resolves to exactly one template, which keeps carrying the manual
-- source, documents and intervals.
--
-- Sales-line templates are kept as models of their own with `variant = 'Linha'`
-- rather than being split into per-trim rows: splitting them would mean
-- inventing year coverage per trim that no manual in the catalogue supports.
-- They stay selectable and stay `is_exact_schedule = false`; the UI badges the
-- difference instead of hiding it.

create table if not exists public.motorcycle_models (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model_name text not null,
  variant text not null default '',
  display_name text not null,
  engine_cc integer not null check (engine_cc > 0),
  country_code text not null default 'BR',
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand, model_name, variant, country_code)
);

create index if not exists motorcycle_models_visible_idx
  on public.motorcycle_models(brand, display_name)
  where is_visible = true;

drop trigger if exists motorcycle_models_set_updated_at on public.motorcycle_models;
create trigger motorcycle_models_set_updated_at
  before update on public.motorcycle_models
  for each row execute function public.set_updated_at();

alter table public.motorcycle_templates
  add column if not exists model_id uuid references public.motorcycle_models(id) on delete cascade;

-- One model row per catalogue entry.  Sales-line rows keep the line label they
-- already had; the two verified CG 160 Start years collapse into a single
-- model with two year entries, which is the duplication the picker showed.
insert into public.motorcycle_models
  (id, brand, model_name, variant, display_name, engine_cc, country_code, is_visible)
values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe001', 'Honda', 'CG 150 / CG 160', 'Linha', 'CG 150 / CG 160', 160, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe002', 'Honda', 'Biz 125', 'Linha', 'Biz 125', 125, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe003', 'Honda', 'Pop 100 / Pop 110i', 'Linha', 'Pop 100 / Pop 110i', 110, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe004', 'Honda', 'NXR Bros 150 / 160', 'Linha', 'NXR Bros 150 / 160', 160, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe005', 'Honda', 'XRE 300', 'Linha', 'XRE 300', 300, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe006', 'Honda', 'PCX 150 / 160', 'Linha', 'PCX 150 / 160', 160, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe007', 'Yamaha', 'Factor 125 / 150', 'Linha', 'Factor 125 / 150', 150, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe008', 'Yamaha', 'Fazer 250', 'Linha', 'Fazer 250', 250, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe009', 'Yamaha', 'Crosser 150', 'Linha', 'Crosser 150', 150, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe010', 'Yamaha', 'Lander 250', 'Linha', 'Lander 250', 250, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe011', 'Honda', 'CG 160', 'Start', 'CG 160 Start', 160, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe020', 'Dafra', 'NH 190', 'Trail', 'NH 190 Trail', 183, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe021', 'Dafra', 'NHX 190', 'Street', 'NHX 190 Street', 183, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe022', 'Dafra', 'NH 300', 'Trail', 'NH 300 Trail', 278, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe023', 'Dafra', 'Cruisym 150', 'Scooter', 'Cruisym 150', 150, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe030', 'Shineray', 'Jet 50S', 'Ciclomotor', 'Jet 50S', 49, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe031', 'Shineray', 'SHI 175', 'Street carburada', 'SHI 175 carburada', 174, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe032', 'Shineray', 'SHI 175S EFI', 'Street EFI', 'SHI 175S EFI', 174, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe033', 'Shineray', 'Free 150 EFI', 'Street', 'Free 150 EFI', 149, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe040', 'KTM', '200 Duke', 'Naked', '200 Duke', 200, 'BR', true),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafe041', 'KTM', '390 Duke', 'Naked', '390 Duke', 390, 'BR', true)
on conflict (id) do update set
  brand = excluded.brand, model_name = excluded.model_name,
  variant = excluded.variant, display_name = excluded.display_name,
  engine_cc = excluded.engine_cc, country_code = excluded.country_code,
  is_visible = excluded.is_visible, updated_at = now();

-- Both CG 160 Start years point at the same model: that is what turns the two
-- "CG 160 Start - 2019" / "CG 160 Start - 2018" options into one model whose
-- year dropdown offers 2019 and 2018.
update public.motorcycle_templates as t
set model_id = m.model_id, updated_at = now()
from (values
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd001'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe001'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd002'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe002'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd003'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe003'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd004'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe004'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd005'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe005'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd006'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe006'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd007'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe007'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd008'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe008'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd009'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe009'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd010'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe010'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd011'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe011'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd012'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe011'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd020'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe020'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd021'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe021'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd022'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe022'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd023'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe023'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd030'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe030'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd031'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe031'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd032'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe032'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd033'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe033'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd040'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe040'::uuid),
  ('0f0bb40e-0aec-4b09-a3f0-2ddc3cafd041'::uuid, '0f0bb40e-0aec-4b09-a3f0-2ddc3cafe041'::uuid)
) as m(template_id, model_id)
where t.id = m.template_id and t.model_id is distinct from m.model_id;

-- A catalogue-visible template without a model can no longer be resolved by the
-- picker, so make that unrepresentable rather than letting it fall out of the
-- list silently.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'motorcycle_templates_visible_needs_model'
      and conrelid = 'public.motorcycle_templates'::regclass
  ) then
    alter table public.motorcycle_templates
      add constraint motorcycle_templates_visible_needs_model
      check (not is_catalog_visible or model_id is not null);
  end if;
end $$;

create index if not exists motorcycle_templates_model_year_idx
  on public.motorcycle_templates(model_id, year_from desc)
  where is_catalog_visible = true;

-- The picker resolves (model, year) to a template, so the database check that
-- guards `motorcycles.source_template_id` has to agree that the chosen year is
-- covered by that template.  Rewritten here only to also require the template
-- to belong to a visible model -- the year and manual-source rules are
-- unchanged from the previous definition.
create or replace function public.validate_motorcycle_catalog_selection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.year is null or new.year <= 1900
    or new.year > extract(year from now())::int then
    raise exception 'Ano invalido para a motocicleta' using errcode = '23514';
  end if;

  if new.source_template_id is not null then
    if not exists (
      select 1
      from public.motorcycle_templates t
      join public.motorcycle_models mo on mo.id = t.model_id
      join public.motorcycle_manual_sources ms on ms.template_id = t.id
      where t.id = new.source_template_id
        and t.is_catalog_visible = true
        and mo.is_visible = true
        and new.year >= t.year_from
        and new.year <= t.year_to
    ) then
      raise exception 'Modelo e ano nao disponiveis no catalogo'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;
