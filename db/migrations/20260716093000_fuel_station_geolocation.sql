alter table public.fuel_stations
  add column latitude numeric(9,6),
  add column longitude numeric(9,6),
  add constraint fuel_stations_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint fuel_stations_longitude_range check (longitude is null or longitude between -180 and 180);

create index fuel_stations_owner_location_idx
  on public.fuel_stations (owner_id, latitude, longitude)
  where latitude is not null and longitude is not null;
