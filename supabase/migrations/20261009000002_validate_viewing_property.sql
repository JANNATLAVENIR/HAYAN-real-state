-- Do not create an appointment for a listing that is hidden from discovery.
create or replace function public.protect_viewing_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  listing_owner uuid;
  dates_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Viewing requester must be the authenticated user';
    end if;
    select owner_id into listing_owner
    from public.properties
    where id = new.property_id
      and status = 'approved'
      and availability_status = 'available';
    if listing_owner is null then
      raise exception 'Property is unavailable for viewing';
    end if;
    if (new.date + new.time) <= (now() at time zone 'Africa/Mogadishu') then
      raise exception 'A new viewing must be scheduled for a future time';
    end if;
    new.agent_id := listing_owner;
    new.status := 'pending';
    return new;
  end if;

  if new.id is distinct from old.id
    or new.property_id is distinct from old.property_id
    or new.user_id is distinct from old.user_id
    or new.agent_id is distinct from old.agent_id then
    raise exception 'Viewing participants and property cannot be changed';
  end if;
  dates_changed := new.date is distinct from old.date or new.time is distinct from old.time;
  if public.is_admin() then
    if dates_changed then
      raise exception 'Administrators can change status but cannot reschedule a viewing';
    end if;
    if new.status is distinct from old.status and new.status not in ('confirmed', 'cancelled') then
      raise exception 'Invalid administrator viewing status';
    end if;
    return new;
  end if;
  if auth.uid() = old.user_id or auth.uid() = old.agent_id then
    if dates_changed and new.status is distinct from old.status then
      raise exception 'Rescheduling cannot change viewing status';
    elsif dates_changed then
      if not exists (
        select 1 from public.properties
        where id = old.property_id
          and owner_id = old.agent_id
          and status = 'approved'
          and availability_status = 'available'
      ) then
        raise exception 'Property is unavailable for rescheduling';
      end if;
      if old.status not in ('pending', 'confirmed') or (new.date + new.time) <= (now() at time zone 'Africa/Mogadishu') then
        raise exception 'Only future pending or confirmed viewings can be rescheduled';
      end if;
    elsif auth.uid() = old.user_id and new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'A requester can only cancel a viewing';
    elsif auth.uid() = old.agent_id and new.status is distinct from old.status and new.status not in ('confirmed', 'cancelled') then
      raise exception 'Invalid viewing status';
    end if;
  else
    raise exception 'Not authorized to update this viewing';
  end if;
  return new;
end;
$$;

-- The existing overlap trigger checks a one-hour interval. Lock both the
-- appointment date and the previous date so cross-midnight requests serialize
-- with each other as well as same-day requests.
create or replace function public.prevent_agent_viewing_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  lock_date date;
begin
  if new.agent_id is null or new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  for lock_date in
    select dates.lock_date
    from unnest(array[new.date - 1, new.date]) as dates(lock_date)
    order by dates.lock_date
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      new.agent_id::text || ':' || lock_date::text,
      0
    ));
  end loop;

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
