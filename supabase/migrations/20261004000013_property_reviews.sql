create table if not exists public.property_reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 1 and 1200),
  created_at timestamptz not null default now(),
  unique (property_id, user_id)
);

alter table public.property_reviews enable row level security;
drop policy if exists "Property reviews are public" on public.property_reviews;
create policy "Property reviews are public"
  on public.property_reviews for select using (true);
drop policy if exists "Signed in users review properties they do not own" on public.property_reviews;
create policy "Signed in users review properties they do not own"
  on public.property_reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.properties p where p.id = property_id and p.owner_id <> auth.uid())
  );
drop policy if exists "Users edit their own property reviews" on public.property_reviews;
create policy "Users edit their own property reviews"
  on public.property_reviews for update to authenticated
  using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.properties p where p.id = property_id and p.owner_id <> (select auth.uid()))
  );
drop policy if exists "Users delete their own property reviews" on public.property_reviews;
create policy "Users delete their own property reviews"
  on public.property_reviews for delete to authenticated using (user_id = auth.uid());
create index if not exists property_reviews_property_created_idx
  on public.property_reviews (property_id, created_at desc);
