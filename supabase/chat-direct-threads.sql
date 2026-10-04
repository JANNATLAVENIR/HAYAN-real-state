-- Merge existing one-to-one threads by participant pair, preserving message history.
drop trigger if exists protect_message_read_receipts on public.messages;

do $$
declare
  participant_pair record;
  canonical_conversation_id uuid;
  duplicate_conversation_id uuid;
begin
  for participant_pair in
    select first_member.user_id as first_user_id, second_member.user_id as second_user_id
    from public.conversation_members first_member
    join public.conversation_members second_member
      on second_member.conversation_id = first_member.conversation_id
      and first_member.user_id < second_member.user_id
    group by first_member.user_id, second_member.user_id
    having count(*) filter (
      where 2 = (
        select count(*)
        from public.conversation_members member_count
        where member_count.conversation_id = first_member.conversation_id
      )
    ) > 1
  loop
    select conversation.id into canonical_conversation_id
    from public.conversations conversation
    where public.is_conversation_member(conversation.id, participant_pair.first_user_id)
      and public.is_conversation_member(conversation.id, participant_pair.second_user_id)
      and (
        select count(*)
        from public.conversation_members member_count
        where member_count.conversation_id = conversation.id
      ) = 2
    order by conversation.created_at, conversation.id
    limit 1;

    for duplicate_conversation_id in
      select conversation.id
      from public.conversations conversation
      where conversation.id <> canonical_conversation_id
        and public.is_conversation_member(conversation.id, participant_pair.first_user_id)
        and public.is_conversation_member(conversation.id, participant_pair.second_user_id)
        and (
          select count(*)
          from public.conversation_members member_count
          where member_count.conversation_id = conversation.id
        ) = 2
    loop
      update public.messages
      set conversation_id = canonical_conversation_id
      where conversation_id = duplicate_conversation_id;

      delete from public.conversations where id = duplicate_conversation_id;
    end loop;
  end loop;
end;
$$;

drop trigger if exists protect_message_read_receipts on public.messages;
create trigger protect_message_read_receipts
before update on public.messages
for each row execute function public.protect_message_read_receipts();

create or replace function public.get_or_create_direct_conversation(
  p_other_user_id uuid,
  p_property_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
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
  if p_other_user_id is null or p_other_user_id = current_user_id then
    raise exception 'Choose another user to message';
  end if;
  if not exists (select 1 from public.profiles where id = p_other_user_id) then
    raise exception 'The other user account no longer exists';
  end if;

  participant_lock_key := hashtextextended(
    least(current_user_id::text, p_other_user_id::text) || ':' || greatest(current_user_id::text, p_other_user_id::text),
    0
  );
  perform pg_advisory_xact_lock(participant_lock_key);

  select conversation.id into direct_conversation_id
  from public.conversations conversation
  where public.is_conversation_member(conversation.id, current_user_id)
    and public.is_conversation_member(conversation.id, p_other_user_id)
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
