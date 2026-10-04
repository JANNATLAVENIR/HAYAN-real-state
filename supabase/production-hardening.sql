-- Apply after schema.sql, admin.sql, admin-management.sql, admin-actions.sql, and admin-policies.sql.
-- Prevent client-controlled profile privileges and listing/viewing state.

create or replace function public.dalka_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true
  );
$$;

revoke all on function public.dalka_is_admin() from public;
grant execute on function public.dalka_is_admin() to authenticated;

drop policy if exists "Profiles are visible to authenticated users" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- Expose only fields needed to label chat participants. Direct profile reads
-- remain limited to the signed-in user's own row and admins.
create or replace view public.public_profiles
with (security_barrier = true)
as select id, name, role, avatar_url, bio from public.profiles;
grant select on public.public_profiles to anon, authenticated;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Profile identity cannot be changed';
    end if;
    if new.role is distinct from old.role and not public.dalka_is_admin() then
      raise exception 'Only an administrator can change account roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
before update on public.profiles
for each row execute function public.protect_profile_privileges();

create or replace function public.protect_property_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_role text;
begin
  if tg_op = 'INSERT' then
    if new.owner_id is distinct from auth.uid() then
      raise exception 'Listing owner must be the authenticated user';
    end if;
    if not public.dalka_is_admin() then
      select role into owner_role from public.profiles where id = auth.uid();
      if owner_role not in ('seller', 'agent') then
        raise exception 'Only sellers and agents can create listings';
      end if;
      new.status := 'pending';
      new.featured := false;
      new.views := 0;
    end if;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then
    raise exception 'Listing ownership and identity cannot be changed';
  end if;
  if not public.dalka_is_admin() and (
    new.status is distinct from old.status
    or new.featured is distinct from old.featured
    or new.views is distinct from old.views
  ) then
    raise exception 'Only an administrator can change listing status, featured state, or views';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_property_state on public.properties;
create trigger protect_property_state
before insert or update on public.properties
for each row execute function public.protect_property_state();

drop policy if exists "Published properties are public" on public.properties;
drop policy if exists "Approved properties are public" on public.properties;
create policy "Approved properties are public"
  on public.properties for select
  using (status = 'approved');

drop policy if exists "Owners can view their own listings" on public.properties;
create policy "Owners can view their own listings"
  on public.properties for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Admins can view all listings" on public.properties;
create policy "Admins can view all listings"
  on public.properties for select to authenticated
  using (public.dalka_is_admin());

create or replace function public.protect_viewing_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_owner uuid;
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Viewing requester must be the authenticated user';
    end if;
    select owner_id into listing_owner from public.properties where id = new.property_id;
    if listing_owner is null then
      raise exception 'Property not found';
    end if;
    new.agent_id := listing_owner;
    new.status := 'pending';
    return new;
  end if;

  if new.id is distinct from old.id
    or new.property_id is distinct from old.property_id
    or new.user_id is distinct from old.user_id
    or new.agent_id is distinct from old.agent_id
    or new.date is distinct from old.date
    or new.time is distinct from old.time then
    raise exception 'Viewing details cannot be changed after creation';
  end if;
  if auth.uid() = old.user_id then
    if new.status <> 'cancelled' then
      raise exception 'A requester can only cancel a viewing';
    end if;
  elsif auth.uid() = old.agent_id then
    if new.status not in ('confirmed', 'cancelled') then
      raise exception 'Invalid viewing status';
    end if;
  else
    raise exception 'Not authorized to update this viewing';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_viewing_state on public.viewings;
update public.viewings viewing
set agent_id = property.owner_id
from public.properties property
where viewing.property_id = property.id
  and viewing.agent_id is null;

create trigger protect_viewing_state
before insert or update on public.viewings
for each row execute function public.protect_viewing_state();

create or replace function public.increment_property_views(property_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_views integer;
begin
  update public.properties
  set views = views + 1
  where id = property_id and status = 'approved'
  returning views into updated_views;
  return updated_views;
end;
$$;

revoke all on function public.increment_property_views(uuid) from public;
grant execute on function public.increment_property_views(uuid) to anon, authenticated;
