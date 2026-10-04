-- Prevent a responsible owner/agent from receiving simultaneous active
-- appointments across different properties. Existing conflicts are preserved;
-- this trigger blocks new conflicts without changing production rows.
create or replace function public.prevent_agent_viewing_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if new.agent_id is null or new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  -- Viewing appointments occupy one hour. Serialize the owner's day so two
  -- simultaneous requests for adjacent, overlapping times cannot race.
  perform pg_advisory_xact_lock(hashtextextended(
    new.agent_id::text || ':' || new.date::text,
    0
  ));

  if exists (
    select 1
    from public.viewings existing
    where existing.agent_id = new.agent_id
      and existing.status in ('pending', 'confirmed')
      and existing.id is distinct from new.id
      and (existing.date + existing.time) < (new.date + new.time + interval '1 hour')
      and (existing.date + existing.time + interval '1 hour') > (new.date + new.time)
  ) then
    raise exception 'This owner or agent already has an overlapping active appointment';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_agent_viewing_overlap on public.viewings;
drop trigger if exists validate_agent_viewing_overlap on public.viewings;
create trigger validate_agent_viewing_overlap
  before insert or update of agent_id, date, time, status on public.viewings
  for each row execute function public.prevent_agent_viewing_overlap();
