create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create type billing_plan as enum ('free', 'pro');
create type billing_interval as enum ('monthly', 'yearly');
create type reminder_trigger_type as enum ('by_km', 'by_date', 'by_interval');
create type severity_level as enum ('critical', 'warning', 'success', 'info');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.legacy_id_map (
  source_table text not null,
  source_id text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (source_table, source_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text default '',
  theme text not null default 'system',
  is_staff boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  id integer primary key default 1 check (id = 1),
  company_name text not null default 'Moto Track',
  cnpj text not null default '',
  support_email text not null default 'suporte@moto-track.net',
  support_phone text not null default '',
  support_whatsapp text not null default '',
  address_street text not null default '',
  address_city text not null default '',
  address_state text not null default '',
  address_zip text not null default '',
  dpo_name text not null default '',
  dpo_email text not null default '',
  terms_last_updated date,
  privacy_last_updated date,
  lgpd_last_updated date,
  cancellation_last_updated date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.motorcycle_templates (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  year_from integer not null check (year_from > 1900),
  year_to integer check (year_to is null or year_to >= year_from),
  variant text not null default '',
  engine_cc integer not null check (engine_cc > 0),
  country_code text not null default 'BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand, model, year_from, year_to, variant, country_code)
);

create table public.motorcycle_template_specs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.motorcycle_templates(id) on delete cascade,
  fuel_tank_capacity_l numeric(5,2),
  fuel_type_recommendation text not null default '',
  fuel_octane_min integer,
  oil_capacity_l numeric(5,2),
  tire_size_front text not null default '',
  tire_size_rear text not null default '',
  tire_speed_rating text not null default '',
  battery_spec text not null default '',
  chain_size text not null default '',
  recommended_tire_pressure_front text not null default '',
  recommended_tire_pressure_rear text not null default '',
  oil_type_recommendation text not null default '',
  oil_viscosity_recommendation text not null default '',
  manual_url text not null default '',
  consumption_avg_km_l numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id)
);

create table public.motorcycles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text not null,
  model text not null,
  year integer not null check (year > 1900),
  source_template_id uuid references public.motorcycle_templates(id) on delete set null,
  photo_key text,
  license_plate text not null default '',
  is_active boolean not null default true,
  deleted_at timestamptz,
  odometer_override_km integer check (odometer_override_km is null or odometer_override_km >= 0),
  odometer_override_at timestamptz,
  current_odometer_km integer not null default 0 check (current_odometer_km >= 0),
  current_odometer_updated_at timestamptz,
  previous_owners integer,
  riding_profile text not null default 'auto',
  purchase_price_cents integer,
  purchase_currency text not null default 'BRL',
  purchase_date date,
  observations text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.motorcycle_specs (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id uuid not null references public.motorcycles(id) on delete cascade,
  fuel_tank_capacity_l numeric(5,2),
  fuel_type_recommendation text not null default '',
  fuel_octane_min integer,
  oil_capacity_l numeric(5,2),
  tire_size_front text not null default '',
  tire_size_rear text not null default '',
  tire_speed_rating text not null default '',
  battery_spec text not null default '',
  chain_size text not null default '',
  recommended_tire_pressure_front text not null default '',
  recommended_tire_pressure_rear text not null default '',
  oil_type_recommendation text not null default '',
  oil_viscosity_recommendation text not null default '',
  manual_reference text not null default '',
  consumption_avg_km_l numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (motorcycle_id)
);

create table public.fuel_stations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text not null default '',
  city text not null default '',
  state text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.fuel_grades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  fuel_type text not null default 'gasoline',
  octane_rating integer,
  ethanol_percentage numeric(5,2),
  default_price_per_liter_millicents integer,
  currency text not null default 'BRL',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.fuel_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete cascade,
  station_id uuid references public.fuel_stations(id) on delete set null,
  fuel_grade_id uuid references public.fuel_grades(id) on delete set null,
  date date not null,
  odometer_km integer not null check (odometer_km >= 0),
  liters numeric(7,3) not null check (liters > 0),
  total_price_cents integer not null default 0 check (total_price_cents >= 0),
  price_per_liter_millicents integer not null default 0 check (price_per_liter_millicents >= 0),
  currency text not null default 'BRL',
  fuel_type text not null default 'gasoline',
  tank_full boolean not null default false,
  receipt_file_key text,
  station_name text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fuel_records_owner_date_idx on public.fuel_records(owner_id, date desc);
create index fuel_records_motorcycle_date_idx on public.fuel_records(motorcycle_id, date desc, odometer_km desc);

create table public.fuel_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete cascade,
  station_id uuid references public.fuel_stations(id) on delete set null,
  fuel_grade_id uuid references public.fuel_grades(id) on delete set null,
  fuel_type text not null default 'gasoline',
  station_name text not null default '',
  price_per_liter_millicents integer,
  currency text not null default 'BRL',
  tank_full boolean not null default true,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fuel_review_preferences (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id uuid not null references public.motorcycles(id) on delete cascade unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  fillups_interval integer not null default 10 check (fillups_interval > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_parts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  manufacturer text not null default '',
  part_type text not null default 'other',
  sku text not null default '',
  price_cents integer,
  currency text not null default 'BRL',
  track_stock boolean not null default false,
  stock_quantity integer not null default 0,
  low_stock_threshold integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete cascade,
  maintenance_type text not null default 'other',
  date date not null,
  odometer_km integer not null check (odometer_km >= 0),
  description text not null default '',
  parts_used text not null default '',
  cost_cents integer not null default 0 check (cost_cents >= 0),
  currency text not null default 'BRL',
  workshop text not null default '',
  interval_km integer check (interval_km is null or interval_km > 0),
  interval_days integer check (interval_days is null or interval_days > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_record_parts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  maintenance_record_id uuid not null references public.maintenance_records(id) on delete cascade,
  part_id uuid not null references public.maintenance_parts(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer,
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maintenance_record_id, part_id)
);

create table public.maintenance_plan_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid not null references public.motorcycles(id) on delete cascade,
  maintenance_type text not null default 'other',
  interval_km integer,
  interval_days integer,
  last_done_km integer,
  last_done_date date,
  is_severe_duty_override boolean not null default false,
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (interval_km is not null or interval_days is not null),
  unique (motorcycle_id, maintenance_type, is_severe_duty_override)
);

create table public.maintenance_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  maintenance_record_id uuid not null references public.maintenance_records(id) on delete cascade,
  image_key text not null,
  caption text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tire_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  manufacturer text not null,
  model_name text not null,
  image_key text,
  tire_type text not null default 'street',
  width_mm integer,
  aspect_ratio integer,
  rim_diameter_in integer,
  load_index text not null default '',
  speed_rating text not null default '',
  max_speed_kmh integer,
  price_cents integer,
  currency text not null default 'BRL',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tire_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete cascade,
  tire_product_id uuid references public.tire_products(id) on delete set null,
  position text not null check (position in ('front', 'rear')),
  brand_model text not null,
  installed_at date not null,
  installed_odometer_km integer not null check (installed_odometer_km >= 0),
  cost_cents integer not null default 0 check (cost_cents >= 0),
  purchase_price_cents integer,
  currency text not null default 'BRL',
  recommended_pressure text not null default '',
  wear_percent integer not null default 0 check (wear_percent between 0 and 100),
  estimated_change_km integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tire_pressure_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete cascade,
  date date not null,
  psi_front integer not null,
  psi_rear integer not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.motorcycle_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete cascade,
  name text not null,
  document_type text not null default 'other',
  file_key text,
  valid_until date,
  notify_before_days integer not null default 30 check (notify_before_days > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete cascade,
  title text not null,
  description text not null default '',
  trigger_type reminder_trigger_type not null default 'by_km',
  trigger_value_km integer,
  trigger_value_days integer,
  reference_km integer,
  reference_date date,
  is_active boolean not null default true,
  last_notified_at timestamptz,
  last_email_notified_at timestamptz,
  last_push_notified_at timestamptz,
  send_email boolean not null default true,
  send_push boolean not null default true,
  notes text not null default '',
  is_recurring boolean not null default false,
  linked_plan_item_id uuid references public.maintenance_plan_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_owner_active_idx on public.reminders(owner_id, is_active);

create table public.annual_fees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete cascade,
  fee_type text not null default 'ipva',
  year integer not null,
  due_date date not null,
  paid_date date,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'BRL',
  notify_before_days integer not null default 30 check (notify_before_days > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (motorcycle_id, fee_type, year)
);

create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete cascade,
  provider text not null,
  policy_number text not null default '',
  coverage_start date not null,
  coverage_end date not null,
  premium_cents integer not null default 0 check (premium_cents >= 0),
  currency text not null default 'BRL',
  notify_before_days integer not null default 30 check (notify_before_days > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coverage_end >= coverage_start)
);

create table public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  policy_id uuid references public.insurance_policies(id) on delete cascade,
  claim_date date not null,
  description text not null,
  amount_cents integer,
  currency text not null default 'BRL',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professional_cost_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid not null references public.motorcycles(id) on delete cascade,
  maintenance_reserve_per_km_millicents integer not null default 12000,
  depreciation_per_km_millicents integer not null default 0,
  fixed_daily_cost_cents integer not null default 0,
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (motorcycle_id)
);

create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete cascade,
  work_date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  odometer_start_km integer not null check (odometer_start_km >= 0),
  odometer_end_km integer not null check (odometer_end_km >= odometer_start_km),
  gross_income_cents integer not null default 0 check (gross_income_cents >= 0),
  tips_cents integer not null default 0 check (tips_cents >= 0),
  fuel_spent_cents integer check (fuel_spent_cents is null or fuel_spent_cents >= 0),
  currency text not null default 'BRL',
  deliveries_count integer not null default 0,
  platform_source text not null default 'other',
  payment_method text not null default 'pix',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table public.subscription_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade unique,
  plan billing_plan not null default 'free',
  billing_interval billing_interval,
  stripe_customer_id text not null default '',
  stripe_subscription_id text not null default '',
  stripe_subscription_status text not null default '',
  stripe_price_id text not null default '',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  grace_until timestamptz,
  latest_invoice_url text not null default '',
  latest_receipt_url text not null default '',
  trial_will_end_notified_at timestamptz,
  next_invoice_at timestamptz,
  next_invoice_amount_cents integer,
  next_invoice_currency text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processing_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_data_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'deletion')),
  status text not null default 'open',
  notes text not null default '',
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default ''
);

create table public.forum_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null,
  meta_description text not null default '',
  cover_image_key text,
  body text not null,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.forum_article_categories (
  article_id uuid references public.forum_articles(id) on delete cascade,
  category_id uuid references public.forum_categories(id) on delete cascade,
  primary key (article_id, category_id)
);

create table public.article_comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid references public.forum_articles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.article_reactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid references public.forum_articles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (article_id, owner_id, emoji)
);

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null default '',
  scopes text not null default '',
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint_encrypted text not null,
  endpoint_hash text not null,
  p256dh_encrypted text not null,
  auth_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, endpoint_hash)
);

create table public.client_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  action text not null,
  result_model text not null default '',
  result_pk uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, token)
);

create table public.object_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  module text not null,
  source_table text not null,
  source_id uuid,
  object_key text not null unique,
  filename text not null,
  content_type text not null default 'application/octet-stream',
  byte_size bigint,
  created_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','site_settings','motorcycle_templates','motorcycle_template_specs','motorcycles','motorcycle_specs',
    'fuel_stations','fuel_grades','fuel_records','fuel_preferences','fuel_review_preferences',
    'maintenance_parts','maintenance_records','maintenance_record_parts','maintenance_plan_items','maintenance_photos',
    'tire_products','tire_records','tire_pressure_records','motorcycle_documents','reminders','annual_fees',
    'insurance_policies','insurance_claims','professional_cost_settings','work_sessions','subscription_profiles',
    'billing_events','account_data_requests','forum_articles','article_comments','api_tokens','push_subscriptions',
    'client_submissions'
  ] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.motorcycles enable row level security;
alter table public.motorcycle_specs enable row level security;
alter table public.fuel_stations enable row level security;
alter table public.fuel_grades enable row level security;
alter table public.fuel_records enable row level security;
alter table public.fuel_preferences enable row level security;
alter table public.fuel_review_preferences enable row level security;
alter table public.maintenance_parts enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.maintenance_record_parts enable row level security;
alter table public.maintenance_plan_items enable row level security;
alter table public.maintenance_photos enable row level security;
alter table public.tire_products enable row level security;
alter table public.tire_records enable row level security;
alter table public.tire_pressure_records enable row level security;
alter table public.motorcycle_documents enable row level security;
alter table public.reminders enable row level security;
alter table public.annual_fees enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.insurance_claims enable row level security;
alter table public.professional_cost_settings enable row level security;
alter table public.work_sessions enable row level security;
alter table public.subscription_profiles enable row level security;
alter table public.account_data_requests enable row level security;
alter table public.article_comments enable row level security;
alter table public.article_reactions enable row level security;
alter table public.api_tokens enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.client_submissions enable row level security;
alter table public.object_files enable row level security;
alter table public.forum_articles enable row level security;
alter table public.forum_categories enable row level security;
alter table public.forum_article_categories enable row level security;

create policy "profiles self read" on public.profiles for select using (id = auth.uid());
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'motorcycles','fuel_stations','fuel_grades','fuel_records','fuel_preferences','fuel_review_preferences',
    'maintenance_parts','maintenance_records','maintenance_record_parts','maintenance_plan_items','maintenance_photos',
    'tire_products','tire_records','tire_pressure_records','motorcycle_documents','reminders','annual_fees',
    'insurance_policies','insurance_claims','professional_cost_settings','work_sessions','subscription_profiles',
    'account_data_requests','article_comments','article_reactions','api_tokens','push_subscriptions','client_submissions',
    'object_files'
  ] loop
    execute format('create policy %L on public.%I for select using (owner_id = auth.uid())', table_name || ' owner select', table_name);
    execute format('create policy %L on public.%I for insert with check (owner_id = auth.uid())', table_name || ' owner insert', table_name);
    execute format('create policy %L on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid())', table_name || ' owner update', table_name);
    execute format('create policy %L on public.%I for delete using (owner_id = auth.uid())', table_name || ' owner delete', table_name);
  end loop;
end $$;

create policy "motorcycle specs via owner" on public.motorcycle_specs
  for all using (exists (select 1 from public.motorcycles m where m.id = motorcycle_id and m.owner_id = auth.uid()))
  with check (exists (select 1 from public.motorcycles m where m.id = motorcycle_id and m.owner_id = auth.uid()));

create policy "public articles read" on public.forum_articles for select using (is_published = true);
create policy "public categories read" on public.forum_categories for select using (true);
create policy "public article categories read" on public.forum_article_categories for select using (true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  insert into public.subscription_profiles (owner_id, plan)
  values (new.id, 'free')
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
