-- Private execution journal used by the account-deletion Edge Function.
-- No user-facing role can read or modify this table.
create table if not exists public.account_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'processing'
    check (status in ('processing', 'failed', 'completed')),
  error_code text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists account_deletion_jobs_one_open_per_user
  on public.account_deletion_jobs (user_id)
  where user_id is not null and status in ('processing', 'failed');

alter table public.account_deletion_jobs enable row level security;
revoke all on public.account_deletion_jobs from public, anon, authenticated;
grant all on public.account_deletion_jobs to service_role;
