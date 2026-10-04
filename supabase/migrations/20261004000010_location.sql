alter table public.properties
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists properties_location_idx
  on public.properties (latitude, longitude);
