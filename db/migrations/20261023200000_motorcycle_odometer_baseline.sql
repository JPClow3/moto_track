-- A creation-time reading is an observation, not a disposable aggregate. Keep
-- it as the manual baseline used by subsequent odometer recomputations.
create or replace function public.capture_initial_motorcycle_odometer()
returns trigger language plpgsql as $$
begin
  if new.odometer_override_km is null then
    new.odometer_override_km := new.current_odometer_km;
    new.odometer_override_at := coalesce(new.odometer_override_at, new.created_at, now());
  end if;
  return new;
end;
$$;

create trigger motorcycles_capture_initial_odometer
before insert on public.motorcycles
for each row execute function public.capture_initial_motorcycle_odometer();

-- With no owned odometer-bearing records, the stored reading cannot be their
-- aggregate. Preserve it. When records exist, the original creation reading
-- cannot be reconstructed safely; do not promote their maximum into a floor.
update public.motorcycles m
set odometer_override_km = m.current_odometer_km,
    odometer_override_at = coalesce(m.current_odometer_updated_at, m.created_at)
where m.odometer_override_km is null
  and not exists (select 1 from public.fuel_records f where f.motorcycle_id = m.id and f.owner_id = m.owner_id)
  and not exists (select 1 from public.maintenance_records r where r.motorcycle_id = m.id and r.owner_id = m.owner_id)
  and not exists (select 1 from public.tire_records t where t.motorcycle_id = m.id and t.owner_id = m.owner_id)
  and not exists (select 1 from public.work_sessions w where w.motorcycle_id = m.id and w.owner_id = m.owner_id);
