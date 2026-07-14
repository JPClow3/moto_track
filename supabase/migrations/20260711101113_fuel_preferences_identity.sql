delete from public.fuel_preferences older
using public.fuel_preferences newer
where older.owner_id = newer.owner_id
  and older.motorcycle_id is not distinct from newer.motorcycle_id
  and older.station_id is not distinct from newer.station_id
  and older.fuel_grade_id is not distinct from newer.fuel_grade_id
  and older.fuel_type = newer.fuel_type
  and older.station_name = newer.station_name
  and (
    coalesce(older.last_used_at, older.created_at) < coalesce(newer.last_used_at, newer.created_at)
    or (
      coalesce(older.last_used_at, older.created_at) = coalesce(newer.last_used_at, newer.created_at)
      and older.id < newer.id
    )
  );

alter table public.fuel_preferences
  add constraint fuel_preferences_identity_unique
  unique nulls not distinct (
    owner_id,
    motorcycle_id,
    station_id,
    fuel_grade_id,
    fuel_type,
    station_name
  );
