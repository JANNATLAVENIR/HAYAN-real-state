create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.saved_searches enable row level security;
drop policy if exists "Users manage their saved searches" on public.saved_searches;
create policy "Users manage their saved searches"
  on public.saved_searches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists saved_searches_user_created_idx
  on public.saved_searches (user_id, created_at desc);
