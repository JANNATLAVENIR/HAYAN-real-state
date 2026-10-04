create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Users can read their own admin status" on public.admin_users;
create policy "Users can read their own admin status"
  on public.admin_users for select to authenticated
  using (user_id = auth.uid());

-- After creating the owner account in Supabase Auth, insert that user's UUID here.
-- insert into public.admin_users (user_id) values ('OWNER_AUTH_USER_UUID');
