-- Never infer purchase mileage from the motorcycle's lifetime odometer.
alter table public.motorcycles
  add column if not exists purchase_odometer_km integer
    check (purchase_odometer_km is null or purchase_odometer_km >= 0);

-- Calendar clients cannot send app sessions. Store only a hash of the revocable
-- bearer secret, scoped to one owner's reminder calendar.
create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists calendar_feeds_owner_idx on public.calendar_feeds(owner_id);

-- A wear percentage is an observation at a particular mileage. Using the live
-- odometer as the measurement would extend projected tire life after every ride.
alter table public.tire_records
  add column if not exists wear_odometer_km integer
    check (wear_odometer_km is null or wear_odometer_km >= 0);

create or replace function public.capture_tire_wear_odometer()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.wear_percent is null then
    new.wear_odometer_km := null;
  elsif tg_op = 'INSERT' then
    select greatest(current_odometer_km, new.installed_odometer_km) into new.wear_odometer_km
      from public.motorcycles where id = new.motorcycle_id and owner_id = new.owner_id;
  elsif new.wear_percent is distinct from old.wear_percent
     or old.wear_odometer_km is null
     or new.motorcycle_id is distinct from old.motorcycle_id
     or new.installed_odometer_km is distinct from old.installed_odometer_km then
    select greatest(current_odometer_km, new.installed_odometer_km) into new.wear_odometer_km
      from public.motorcycles where id = new.motorcycle_id and owner_id = new.owner_id;
  else
    new.wear_odometer_km := old.wear_odometer_km;
  end if;
  return new;
end;
$$;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tire_wear_odometer'
    and tgrelid = 'public.tire_records'::regclass) then
    create trigger tire_wear_odometer before insert or update on public.tire_records
      for each row execute function public.capture_tire_wear_odometer();
  end if;
end;
$$;
