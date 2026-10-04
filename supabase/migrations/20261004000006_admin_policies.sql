-- Admin-only read access for the owner dashboard.
-- The admin_users row is the source of truth for owner access.

create or replace function public.is_admin()
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

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can manage properties" on public.properties;
create policy "Admins can manage properties"
  on public.properties for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can view all viewings" on public.viewings;
create policy "Admins can view all viewings"
  on public.viewings for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update all viewings" on public.viewings;
create policy "Admins can update all viewings"
  on public.viewings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can view all conversations" on public.conversations;
create policy "Admins can view all conversations"
  on public.conversations for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can view all messages" on public.messages;
create policy "Admins can view all messages"
  on public.messages for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can manage all alerts" on public.alerts;
create policy "Admins can manage all alerts"
  on public.alerts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
