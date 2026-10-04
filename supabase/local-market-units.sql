-- Safe to re-run: only rows still marked sqft are converted.
alter table public.properties
  add column if not exists area_unit text not null default 'sqft';

-- Legacy app data stored area in square feet. Normalize it to square metres.
update public.properties
set area = round((area / 10.7639)::numeric, 2),
    area_unit = 'sqm'
where area_unit = 'sqft';

alter table public.properties
  drop constraint if exists properties_area_unit_check;

alter table public.properties
  add constraint properties_area_unit_check check (area_unit in ('sqm'));

alter table public.properties
  alter column area_unit set default 'sqm';
