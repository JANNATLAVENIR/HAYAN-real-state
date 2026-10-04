alter table public.properties
  add column if not exists status text not null default 'approved'
  check (status in ('pending', 'approved', 'rejected'));

create index if not exists properties_status_idx on public.properties (status);

-- Existing demo properties remain visible. New properties can be changed to pending later.
