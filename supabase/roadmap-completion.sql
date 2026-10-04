-- Run after schema.sql and the existing production hardening, alert,
-- saved-search, profile-follow, and storage migrations.

create table if not exists public.property_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.property_collection_items (
  collection_id uuid not null references public.property_collections(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, property_id)
);

alter table public.property_collections enable row level security;
alter table public.property_collection_items enable row level security;

drop policy if exists "Users manage their own property collections" on public.property_collections;
create policy "Users manage their own property collections"
  on public.property_collections for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage items in their own collections" on public.property_collection_items;
create policy "Users manage items in their own collections"
  on public.property_collection_items for all to authenticated
  using (exists (
    select 1 from public.property_collections c
    where c.id = collection_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.property_collections c
    where c.id = collection_id and c.user_id = (select auth.uid())
  ));

create index if not exists property_collections_user_created_idx
  on public.property_collections (user_id, created_at desc);
create index if not exists property_collection_items_property_idx
  on public.property_collection_items (property_id);

-- Device tokens are private to their signed-in owner. The Edge Function
-- uses service-role access after it is configured as an alerts database webhook.
create table if not exists public.push_devices (
  expo_push_token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

alter table public.push_devices enable row level security;
drop policy if exists "Users manage their own push devices" on public.push_devices;
create policy "Users manage their own push devices"
  on public.push_devices for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index if not exists push_devices_user_idx on public.push_devices (user_id);

create table if not exists public.agent_reviews (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 1 and 1200),
  created_at timestamptz not null default now(),
  unique (agent_id, user_id),
  check (agent_id <> user_id)
);

alter table public.agent_reviews enable row level security;
drop policy if exists "Agent reviews are public" on public.agent_reviews;
create policy "Agent reviews are public"
  on public.agent_reviews for select using (true);
drop policy if exists "Signed in users review agents they do not own" on public.agent_reviews;
create policy "Signed in users review agents they do not own"
  on public.agent_reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and agent_id <> (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = agent_id and p.role = 'agent')
  );
drop policy if exists "Users edit their own agent reviews" on public.agent_reviews;
create policy "Users edit their own agent reviews"
  on public.agent_reviews for update to authenticated
  using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and agent_id <> (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = agent_id and p.role = 'agent')
  );
drop policy if exists "Users delete their own agent reviews" on public.agent_reviews;
create policy "Users delete their own agent reviews"
  on public.agent_reviews for delete to authenticated using (user_id = (select auth.uid()));
create index if not exists agent_reviews_agent_created_idx
  on public.agent_reviews (agent_id, created_at desc);

create or replace function public.register_push_device(p_expo_push_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.dalka_mfa_satisfied() then raise exception 'Complete the second authentication factor first'; end if;
  if p_expo_push_token is null or length(p_expo_push_token) > 512 then raise exception 'Invalid push token'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'Unsupported platform'; end if;
  insert into public.push_devices (expo_push_token, user_id, platform, updated_at)
  values (p_expo_push_token, auth.uid(), p_platform, now())
  on conflict (expo_push_token) do update
  set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
end;
$$;

revoke all on function public.register_push_device(text, text) from public;
grant execute on function public.register_push_device(text, text) to authenticated;

-- MFA is optional. Once a user verifies a factor, require an AAL2 session for
-- that user's authenticated data operations. Public/anonymous listing reads remain public.
create or replace function public.dalka_mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    not exists (
      select 1 from auth.mfa_factors factor
      where factor.user_id = auth.uid() and factor.status = 'verified'
    )
    or coalesce(auth.jwt() ->> 'aal' = 'aal2', false)
  );
$$;

revoke all on function public.dalka_mfa_satisfied() from public;
grant execute on function public.dalka_mfa_satisfied() to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'admin_users', 'profiles', 'properties', 'bookmarks', 'viewings',
    'conversations', 'conversation_members', 'messages', 'alerts',
    'saved_searches', 'property_reviews', 'profile_follows',
    'property_collections', 'property_collection_items', 'push_devices', 'agent_reviews'
  ] loop
    execute format('drop policy if exists "Verified MFA session required" on public.%I', table_name);
    execute format(
      'create policy "Verified MFA session required" on public.%I as restrictive for all to authenticated using ((select public.dalka_mfa_satisfied())) with check ((select public.dalka_mfa_satisfied()))',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.dalka_try_numeric(value text)
returns numeric
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if value is null or value !~ '^[-+]?[0-9]+(\.[0-9]+)?$' then return null; end if;
  return value::numeric;
exception when others then return null;
end;
$$;

create or replace function public.dalka_try_integer(value text)
returns integer
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if value is null or value !~ '^[-+]?[0-9]+$' then return null; end if;
  return value::integer;
exception when others then return null;
end;
$$;

-- New-listing alerts for saved searches. Filters use the same JSON keys as
-- FilterOptions in the mobile app. Unknown keys are ignored safely.
create or replace function public.notify_saved_search_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    insert into public.alerts (user_id, type, title, body, property_id)
    select s.user_id, 'new_listing', 'New listing matches your search', new.title, new.id
    from public.saved_searches s
    where s.user_id <> new.owner_id
      and (nullif(s.filters ->> 'city', '') is null or lower(new.city) like '%' || lower(s.filters ->> 'city') || '%')
      and (nullif(s.filters ->> 'query', '') is null or lower(new.title || ' ' || new.address || ' ' || new.city) like '%' || lower(s.filters ->> 'query') || '%')
      and (public.dalka_try_numeric(s.filters ->> 'minPrice') is null or new.price >= public.dalka_try_numeric(s.filters ->> 'minPrice'))
      and (public.dalka_try_numeric(s.filters ->> 'maxPrice') is null or new.price <= public.dalka_try_numeric(s.filters ->> 'maxPrice'))
      and (s.filters ->> 'listingType' is null or s.filters ->> 'listingType' = new.listing_type)
      and (jsonb_typeof(s.filters -> 'type') is distinct from 'array' or s.filters -> 'type' = '[]'::jsonb or (s.filters -> 'type') ? new.type)
      and (public.dalka_try_integer(s.filters ->> 'minBedrooms') is null or new.bedrooms >= public.dalka_try_integer(s.filters ->> 'minBedrooms'))
      and (public.dalka_try_integer(s.filters ->> 'maxBedrooms') is null or new.bedrooms <= public.dalka_try_integer(s.filters ->> 'maxBedrooms'))
      and (public.dalka_try_integer(s.filters ->> 'minBathrooms') is null or new.bathrooms >= public.dalka_try_integer(s.filters ->> 'minBathrooms'))
      and (s.filters ->> 'petFriendly' is distinct from 'true' or new.pet_friendly)
      and (s.filters ->> 'parking' is distinct from 'true' or new.amenities @> array['parking']::text[]);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_saved_search_matches on public.properties;
create trigger notify_saved_search_matches
  after update of status on public.properties
  for each row execute function public.notify_saved_search_matches();

