-- The time of a historical observation cannot be recovered from updated_at:
-- that column also changes when cost, brand or installation data is corrected.
alter table public.tire_records
  add column if not exists wear_observed_at timestamptz;

create or replace function public.capture_tire_wear_odometer()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  capture boolean;
begin
  if new.wear_percent is null then
    new.wear_odometer_km := null;
    new.wear_observed_at := null;
    return new;
  end if;
  if tg_op = 'INSERT' then
    capture := true;
  else
    capture := new.wear_percent is distinct from old.wear_percent
      or new.motorcycle_id is distinct from old.motorcycle_id
      or new.owner_id is distinct from old.owner_id
      -- The dedicated measurement action changes this marker even for the
      -- same percentage. Generic metadata forms never submit the marker.
      or (new.wear_observed_at is not null and new.wear_observed_at is distinct from old.wear_observed_at);
  end if;
  if capture then
    select greatest(current_odometer_km, new.installed_odometer_km) into new.wear_odometer_km
      from public.motorcycles where id = new.motorcycle_id and owner_id = new.owner_id;
    new.wear_observed_at := case when new.wear_odometer_km is not null then clock_timestamp() end;
  else
    -- Installation-mileage corrections do not constitute another inspection.
    -- In particular, a legacy NULL observation remains unknown on other edits.
    new.wear_odometer_km := old.wear_odometer_km;
    new.wear_observed_at := old.wear_observed_at;
  end if;
  return new;
end;
$$;
