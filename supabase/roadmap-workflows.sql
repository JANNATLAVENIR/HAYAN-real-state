-- Apply after roadmap-completion.sql. Adds owner availability, public contact
-- consent, listing reports, seller/agent verification requests, audit history,
-- and safe rescheduling for viewing participants.

alter table public.properties
  add column if not exists availability_status text not null default 'available';

alter table public.properties
  drop constraint if exists properties_availability_status_check;
alter table public.properties
  add constraint properties_availability_status_check
  check (availability_status in ('available', 'rented', 'sold', 'unavailable'));
alter table public.properties
  drop constraint if exists properties_availability_type_check;
alter table public.properties
  add constraint properties_availability_type_check
  check ((availability_status <> 'rented' or listing_type = 'rent') and (availability_status <> 'sold' or listing_type = 'sale'));

alter table public.profiles
  add column if not exists phone_visible_to_public boolean not null default false,
  add column if not exists is_verified boolean not null default false;

create or replace view public.public_profiles
with (security_barrier = true)
as select id, name, role, avatar_url, bio,
  case when phone_visible_to_public then phone else null end as public_phone,
  is_verified
from public.profiles;
grant select on public.public_profiles to anon, authenticated;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Profile identity cannot be changed';
  end if;
  if not public.is_admin() and (
    new.role is distinct from old.role
    or new.is_suspended is distinct from old.is_suspended
    or new.is_verified is distinct from old.is_verified
  ) then
    raise exception 'Only an administrator can change account privileges or verification';
  end if;
  return new;
end;
$$;

create table if not exists public.property_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('incorrect_information', 'unavailable', 'fraud_suspicion', 'inappropriate', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (property_id, reporter_id)
);
alter table public.property_reports enable row level security;
drop policy if exists "Users report listings" on public.property_reports;
create policy "Users report listings"
  on public.property_reports for insert to authenticated
  with check (
    reporter_id = auth.uid() and status = 'open' and reviewed_by is null and reviewed_at is null
    and exists (select 1 from public.properties p where p.id = property_id and p.owner_id <> auth.uid())
  );
drop policy if exists "Users read their own listing reports" on public.property_reports;
create policy "Users read their own listing reports"
  on public.property_reports for select to authenticated
  using (reporter_id = auth.uid());
drop policy if exists "Admins manage listing reports" on public.property_reports;
create policy "Admins manage listing reports"
  on public.property_reports for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create index if not exists property_reports_status_created_idx
  on public.property_reports (status, created_at desc);

create table if not exists public.seller_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists one_pending_seller_verification_per_user
  on public.seller_verification_requests (user_id) where status = 'pending';
alter table public.seller_verification_requests enable row level security;
drop policy if exists "Sellers request verification" on public.seller_verification_requests;
create policy "Sellers request verification"
  on public.seller_verification_requests for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('seller', 'agent'))
  );
drop policy if exists "Users read their verification requests" on public.seller_verification_requests;
create policy "Users read their verification requests"
  on public.seller_verification_requests for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Admins manage verification requests" on public.seller_verification_requests;
create policy "Admins manage verification requests"
  on public.seller_verification_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.apply_verification_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Verification request owner cannot be changed';
  end if;
  if new.status is distinct from old.status then
    if not public.is_admin() or new.status not in ('approved', 'rejected') then
      raise exception 'Only an administrator can decide a verification request';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
    update public.profiles
      set is_verified = (new.status = 'approved')
      where id = new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists apply_verification_decision on public.seller_verification_requests;
create trigger apply_verification_decision
before update on public.seller_verification_requests
for each row execute function public.apply_verification_decision();

create table if not exists public.admin_action_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_action_logs enable row level security;
drop policy if exists "Admins read action history" on public.admin_action_logs;
create policy "Admins read action history"
  on public.admin_action_logs for select to authenticated
  using (public.is_admin());

do $$
declare table_name text;
begin
  foreach table_name in array array['property_reports', 'seller_verification_requests', 'admin_action_logs'] loop
    execute format('drop policy if exists "Verified MFA session required" on public.%I', table_name);
    execute format(
      'create policy "Verified MFA session required" on public.%I as restrictive for all to authenticated using ((select public.dalka_mfa_satisfied())) with check ((select public.dalka_mfa_satisfied()))',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.log_admin_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text;
  target_kind text := tg_table_name;
  target_uuid uuid;
  extra jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then return new; end if;
  if tg_table_name = 'properties' then
    if old.status is distinct from new.status then
      action_name := 'listing_status_changed';
      extra := jsonb_build_object('from', old.status, 'to', new.status);
    elsif old.availability_status is distinct from new.availability_status then
      action_name := 'listing_availability_changed';
      extra := jsonb_build_object('from', old.availability_status, 'to', new.availability_status);
    elsif old.featured is distinct from new.featured then
      action_name := 'listing_featured_changed';
      extra := jsonb_build_object('from', old.featured, 'to', new.featured);
    end if;
    target_uuid := new.id;
  elsif tg_table_name = 'profiles' then
    if old.role is distinct from new.role then
      action_name := 'user_role_changed';
      extra := jsonb_build_object('from', old.role, 'to', new.role);
    elsif old.is_suspended is distinct from new.is_suspended then
      action_name := 'user_suspension_changed';
      extra := jsonb_build_object('from', old.is_suspended, 'to', new.is_suspended);
    elsif old.is_verified is distinct from new.is_verified then
      action_name := 'user_verification_changed';
      extra := jsonb_build_object('from', old.is_verified, 'to', new.is_verified);
    end if;
    target_uuid := new.id;
  elsif tg_table_name = 'property_reports' then
    if old.status is not distinct from new.status then return new; end if;
    action_name := 'listing_report_reviewed';
    target_uuid := new.id;
    extra := jsonb_build_object('property_id', new.property_id, 'from', old.status, 'to', new.status);
  elsif tg_table_name = 'seller_verification_requests' then
    if old.status is not distinct from new.status then return new; end if;
    action_name := 'seller_verification_reviewed';
    target_uuid := new.id;
    extra := jsonb_build_object('user_id', new.user_id, 'from', old.status, 'to', new.status);
  end if;
  if action_name is not null then
    insert into public.admin_action_logs (admin_id, action, target_type, target_id, details)
    values (auth.uid(), action_name, target_kind, target_uuid, extra);
  end if;
  return new;
end;
$$;

drop trigger if exists log_admin_property_action on public.properties;
create trigger log_admin_property_action after update on public.properties
for each row execute function public.log_admin_action();
create or replace function public.log_admin_listing_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    insert into public.admin_action_logs (admin_id, action, target_type, target_id, details)
    values (auth.uid(), 'listing_deleted', 'properties', old.id, jsonb_build_object('title', old.title, 'city', old.city));
  end if;
  return old;
end;
$$;
drop trigger if exists log_admin_listing_delete on public.properties;
create trigger log_admin_listing_delete after delete on public.properties
for each row execute function public.log_admin_listing_delete();
drop trigger if exists log_admin_profile_action on public.profiles;
create trigger log_admin_profile_action after update on public.profiles
for each row execute function public.log_admin_action();
drop trigger if exists log_admin_report_action on public.property_reports;
create trigger log_admin_report_action after update on public.property_reports
for each row execute function public.log_admin_action();
drop trigger if exists log_admin_verification_action on public.seller_verification_requests;
create trigger log_admin_verification_action after update on public.seller_verification_requests
for each row execute function public.log_admin_action();

-- Owners may update listing content and availability. Any material content edit
-- returns the listing to moderation; only admins can set approval/featured/views.
create or replace function public.protect_property_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_role text;
  content_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.owner_id is distinct from auth.uid() then
      raise exception 'Listing owner must be the authenticated user';
    end if;
    if not public.is_admin() then
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
  if not public.is_admin() then
    if new.status is distinct from old.status
      or new.featured is distinct from old.featured
      or new.views is distinct from old.views then
      raise exception 'Only an administrator can change moderation status, featured state, or views';
    end if;
    content_changed :=
      new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.price is distinct from old.price
      or new.type is distinct from old.type
      or new.listing_type is distinct from old.listing_type
      or new.bedrooms is distinct from old.bedrooms
      or new.bathrooms is distinct from old.bathrooms
      or new.area is distinct from old.area
      or new.address is distinct from old.address
      or new.city is distinct from old.city
      or new.images is distinct from old.images
      or new.amenities is distinct from old.amenities
      or new.pet_friendly is distinct from old.pet_friendly
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude;
    if content_changed then new.status := 'pending'; end if;
  end if;
  return new;
end;
$$;

-- Participants may reschedule without allowing client code to edit another
-- participant's identity, property, or viewing status.
create or replace function public.protect_viewing_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_owner uuid;
  dates_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Viewing requester must be the authenticated user';
    end if;
    select owner_id into listing_owner from public.properties where id = new.property_id;
    if listing_owner is null then raise exception 'Property not found'; end if;
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
  if auth.uid() = old.user_id or auth.uid() = old.agent_id then
    if dates_changed and new.status is distinct from old.status then
      raise exception 'Rescheduling cannot change viewing status';
    elsif dates_changed then
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

