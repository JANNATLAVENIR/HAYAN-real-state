alter table public.conversations
  add column if not exists created_by uuid references public.profiles(id) on delete cascade;

create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = p_conversation_id
      and user_id = p_user_id
  );
$$;

create or replace function public.is_conversation_creator(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.conversations
    where id = p_conversation_id
      and created_by = p_user_id
  );
$$;

revoke all on function public.is_conversation_member(uuid, uuid) from public;
revoke all on function public.is_conversation_creator(uuid, uuid) from public;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;
grant execute on function public.is_conversation_creator(uuid, uuid) to authenticated;

drop policy if exists "Members see conversations" on public.conversations;
drop policy if exists "Authenticated users create conversations" on public.conversations;
create policy "Members see conversations"
  on public.conversations for select to authenticated
  using (public.is_conversation_member(id, auth.uid()));
create policy "Authenticated users create conversations"
  on public.conversations for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Members see conversation members" on public.conversation_members;
drop policy if exists "Conversation creators add members" on public.conversation_members;
create policy "Members see conversation members"
  on public.conversation_members for select to authenticated using (
    user_id = auth.uid()
    or public.is_conversation_member(conversation_id, auth.uid())
    or public.is_conversation_creator(conversation_id, auth.uid())
  );
create policy "Conversation creators add members"
  on public.conversation_members for insert to authenticated
  with check (public.is_conversation_creator(conversation_id, auth.uid()));

drop policy if exists "Members see messages" on public.messages;
drop policy if exists "Members send messages" on public.messages;
create policy "Members see messages"
  on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "Members send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id, auth.uid())
  );

drop policy if exists "Recipients mark messages as read" on public.messages;
create policy "Recipients mark messages as read"
  on public.messages for update to authenticated
  using (
    public.is_conversation_member(conversation_id, auth.uid())
    and sender_id <> auth.uid()
    and read_at is null
  )
  with check (
    public.is_conversation_member(conversation_id, auth.uid())
    and sender_id <> auth.uid()
    and read_at is not null
  );

create or replace function public.protect_message_read_receipts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.text is distinct from old.text
    or new.created_at is distinct from old.created_at then
    raise exception 'Messages are immutable after sending';
  end if;
  if old.read_at is not null or new.read_at is null or old.sender_id = auth.uid() then
    raise exception 'Only recipients can mark unread messages as read';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_message_read_receipts on public.messages;
create trigger protect_message_read_receipts
before update on public.messages
for each row execute function public.protect_message_read_receipts();
