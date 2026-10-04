create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'renter', 'agent')),
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  price numeric not null check (price >= 0),
  type text not null check (type in ('apartment', 'house', 'land', 'villa', 'penthouse')),
  listing_type text not null check (listing_type in ('sale', 'rent')),
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  area numeric not null default 0 check (area >= 0),
  area_unit text not null default 'sqm' check (area_unit in ('sqm')),
  address text not null,
  city text not null,
  images text[] not null default '{}',
  amenities text[] not null default '{}',
  pet_friendly boolean not null default false,
  featured boolean not null default false,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  views integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create table public.viewings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid references public.profiles(id) on delete set null,
  date date not null,
  time time not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('price_drop', 'new_listing', 'message', 'viewing')),
  title text not null,
  body text not null,
  property_id uuid references public.properties(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.bookmarks enable row level security;
alter table public.viewings enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.alerts enable row level security;

create policy "Profiles are visible to authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users manage their own profile"
  on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Published properties are public"
  on public.properties for select using (true);
create policy "Owners manage their properties"
  on public.properties for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Users manage their bookmarks"
  on public.bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users see their viewings"
  on public.viewings for select to authenticated using (user_id = auth.uid() or agent_id = auth.uid());
create policy "Users create their viewings"
  on public.viewings for insert to authenticated with check (user_id = auth.uid());
create policy "Participants update viewings"
  on public.viewings for update to authenticated using (user_id = auth.uid() or agent_id = auth.uid());

create policy "Members see conversations"
  on public.conversations for select to authenticated using (
    exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = auth.uid())
  );
create policy "Members see conversation members"
  on public.conversation_members for select to authenticated using (user_id = auth.uid());
create policy "Members see messages"
  on public.messages for select to authenticated using (
    exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid())
  );
create policy "Members send messages"
  on public.messages for insert to authenticated with check (
    sender_id = auth.uid() and exists (
      select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()
    )
  );

create policy "Users manage their alerts"
  on public.alerts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index properties_city_idx on public.properties (city);
create index properties_owner_idx on public.properties (owner_id);
create index viewings_user_idx on public.viewings (user_id);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index alerts_user_idx on public.alerts (user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    case
      when new.raw_user_meta_data ->> 'role' in ('buyer', 'seller', 'renter')
        then new.raw_user_meta_data ->> 'role'
      else 'buyer'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
