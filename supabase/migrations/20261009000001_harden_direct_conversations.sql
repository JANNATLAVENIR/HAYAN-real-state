-- Direct conversations are created only through the checked RPC. This prevents
-- clients from adding arbitrary members after a thread has been created.
drop policy if exists "Conversation creators add members" on public.conversation_members;
drop policy if exists "Authenticated users create conversations" on public.conversations;

-- These helpers are exposed to authenticated policies, so callers may only
-- ask about their own membership/creator status.
create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select p_user_id = auth.uid() and exists (
    select 1
    from public.conversation_members
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_conversation_creator(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select p_user_id = auth.uid() and exists (
    select 1
    from public.conversations
    where id = p_conversation_id
      and created_by = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid, uuid) from public;
revoke all on function public.is_conversation_creator(uuid, uuid) from public;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;
grant execute on function public.is_conversation_creator(uuid, uuid) to authenticated;

create or replace function public.get_or_create_direct_conversation(
  p_other_user_id uuid,
  p_property_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  direct_conversation_id uuid;
  participant_lock_key bigint;
begin
  if current_user_id is null then
    raise exception 'Sign in to start a conversation';
  end if;
  if not public.is_approved_user() then
    raise exception 'An approved account is required to start a conversation';
  end if;
  if not public.dalka_mfa_satisfied() then
    raise exception 'Complete the second authentication factor first';
  end if;
  if p_other_user_id is null or p_other_user_id = current_user_id then
    raise exception 'Choose another user to message';
  end if;
  if not exists (
    select 1
    from public.profiles
    where id = p_other_user_id
      and approval_status = 'approved'
      and not is_suspended
  ) then
    raise exception 'The other user account is unavailable';
  end if;
  if p_property_id is not null and not exists (
    select 1
    from public.properties
    where id = p_property_id
      and owner_id = p_other_user_id
  ) then
    raise exception 'The selected property does not belong to this user';
  end if;

  participant_lock_key := hashtextextended(
    least(current_user_id::text, p_other_user_id::text) || ':' || greatest(current_user_id::text, p_other_user_id::text),
    0
  );
  perform pg_advisory_xact_lock(participant_lock_key);

  select conversation.id into direct_conversation_id
  from public.conversations conversation
  where exists (
      select 1 from public.conversation_members current_member
      where current_member.conversation_id = conversation.id
        and current_member.user_id = current_user_id
    )
    and exists (
      select 1 from public.conversation_members other_member
      where other_member.conversation_id = conversation.id
        and other_member.user_id = p_other_user_id
    )
    and (
      select count(*)
      from public.conversation_members member_count
      where member_count.conversation_id = conversation.id
    ) = 2
  order by conversation.created_at, conversation.id
  limit 1;

  if direct_conversation_id is not null then
    return direct_conversation_id;
  end if;

  insert into public.conversations (property_id, created_by)
  values (p_property_id, current_user_id)
  returning id into direct_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values (direct_conversation_id, current_user_id), (direct_conversation_id, p_other_user_id);

  return direct_conversation_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid, uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid, uuid) to authenticated;
