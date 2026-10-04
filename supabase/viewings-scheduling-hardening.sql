-- Assign viewing requests to the property's owner and prevent overlapping
-- active appointments for the same property, date, and time.

update public.viewings v
set agent_id = p.owner_id
from public.properties p
where v.property_id = p.id
  and v.agent_id is null;

create or replace function public.assign_viewing_property_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  select p.owner_id
    into new.agent_id
    from public.properties p
   where p.id = new.property_id;

  if new.agent_id is null then
    raise exception 'Cannot schedule a viewing for a property without an owner';
  end if;

  return new;
end;
$$;

drop trigger if exists assign_viewing_property_owner on public.viewings;
create trigger assign_viewing_property_owner
  before insert or update on public.viewings
  for each row execute function public.assign_viewing_property_owner();

do $$
begin
  if exists (
    select 1
      from public.viewings
     where status in ('pending', 'confirmed')
     group by property_id, date, time
    having count(*) > 1
  ) then
    raise exception 'Duplicate active viewing slots exist. Resolve them before applying the unique viewing-slot index.';
  end if;
end;
$$;

create unique index if not exists viewings_active_slot_unique
  on public.viewings (property_id, date, time)
  where status in ('pending', 'confirmed');

create index if not exists viewings_agent_date_time_idx
  on public.viewings (agent_id, date, time);
