-- New signups wait for an administrator. Existing accounts stay approved.
alter table public.profiles
  add column if not exists approval_status text not null default 'approved';

alter table public.profiles
  drop constraint if exists profiles_approval_status_check;
alter table public.profiles
  add constraint profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

create index if not exists profiles_approval_status_created_at_idx
  on public.profiles (approval_status, created_at desc);

create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.dalka_is_admin() or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and approval_status = 'approved'
      and not is_suspended
  );
$$;

revoke all on function public.is_approved_user() from public;
grant execute on function public.is_approved_user() to authenticated;

-- The profile row remains readable by its owner so the app can explain
-- whether an account is waiting, approved, or rejected. Its status is admin-only.
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
    or new.approval_status is distinct from old.approval_status
  ) then
    raise exception 'Only an administrator can change account access or verification';
  end if;
  return new;
end;
$$;

-- Create new auth profiles in the pending state. Existing profiles are untouched.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, phone, role, approval_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    case
      when new.raw_user_meta_data ->> 'role' in ('buyer', 'seller', 'renter')
        then new.raw_user_meta_data ->> 'role'
      else 'buyer'
    end,
    'pending'
  );
  return new;
end;
$$;

-- Restrict every RLS-protected public table other than profiles for pending and
-- rejected accounts. The restrictive policy combines with existing row policies.
do $$
declare
  target record;
begin
  for target in
    select cls.relname as table_name
    from pg_class cls
    join pg_namespace ns on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and cls.relkind in ('r', 'p')
      and cls.relrowsecurity
      and cls.relname <> 'profiles'
  loop
    execute format('drop policy if exists %I on public.%I', 'Approved accounts only', target.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.is_approved_user()) with check (public.is_approved_user())',
      'Approved accounts only', target.table_name
    );
  end loop;
end;
$$;

drop policy if exists "Approved accounts only" on storage.objects;
create policy "Approved accounts only"
  on storage.objects as restrictive for all to authenticated
  using (public.is_approved_user())
  with check (public.is_approved_user());

-- Public visual configuration is readable by every visitor; only admins can edit it.
create table if not exists public.site_settings (
  id text primary key check (id = 'branding'),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
  on public.site_settings for select to anon, authenticated
  using (true);
drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings"
  on public.site_settings for all to authenticated
  using (public.dalka_is_admin())
  with check (public.dalka_is_admin());
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
