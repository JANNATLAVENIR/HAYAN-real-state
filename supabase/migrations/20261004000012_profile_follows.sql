create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint profile_follows_not_self check (follower_id <> followed_id)
);

alter table public.profile_follows enable row level security;

grant select, insert, delete on public.profile_follows to authenticated;

drop policy if exists "Authenticated users can view follow relationships" on public.profile_follows;
create policy "Authenticated users can view follow relationships"
  on public.profile_follows for select to authenticated
  using (true);

drop policy if exists "Users can follow sellers and agents" on public.profile_follows;
create policy "Users can follow sellers and agents"
  on public.profile_follows for insert to authenticated
  with check (
    follower_id = auth.uid()
    and followed_id <> auth.uid()
    and exists (
      select 1 from public.profiles
      where id = followed_id and role in ('seller', 'agent')
    )
  );

drop policy if exists "Users can unfollow profiles" on public.profile_follows;
create policy "Users can unfollow profiles"
  on public.profile_follows for delete to authenticated
  using (follower_id = auth.uid());

create index if not exists profile_follows_followed_idx
  on public.profile_follows (followed_id, created_at desc);

create or replace function public.get_public_follow_stats(p_profile_id uuid)
returns table (follower_count bigint, following_count bigint)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    (select count(*) from public.profile_follows where followed_id = p_profile_id),
    (select count(*) from public.profile_follows where follower_id = p_profile_id);
$$;

revoke all on function public.get_public_follow_stats(uuid) from public;
grant execute on function public.get_public_follow_stats(uuid) to anon, authenticated;

create or replace function public.notify_price_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.price < old.price and new.status = 'approved' then
    insert into public.alerts (user_id, type, title, body, property_id)
    select recipients.user_id, 'price_drop', 'Price reduced', 'A property you follow or saved has a lower asking price.', new.id
    from (
      select bookmark.user_id
      from public.bookmarks bookmark
      where bookmark.property_id = new.id
      union
      select follow.follower_id
      from public.profile_follows follow
      where follow.followed_id = new.owner_id
    ) recipients;
  end if;

  return new;
end;
$$;

create or replace function public.notify_listing_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    insert into public.alerts (user_id, type, title, body, property_id)
    select recipients.user_id, 'new_listing', 'New property listing', 'A seller you follow has published a new property.', new.id
    from (
      select new.owner_id as user_id
      union
      select follow.follower_id
      from public.profile_follows follow
      where follow.followed_id = new.owner_id
    ) recipients;
  end if;

  return new;
end;
$$;
