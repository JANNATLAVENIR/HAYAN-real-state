create or replace function public.notify_message_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_property_id uuid;
begin
  select property_id into linked_property_id
  from public.conversations
  where id = new.conversation_id;

  insert into public.alerts (user_id, type, title, body, property_id)
  select member.user_id, 'message', 'New message', left(new.text, 160), linked_property_id
  from public.conversation_members member
  where member.conversation_id = new.conversation_id
    and member.user_id <> new.sender_id;

  return new;
end;
$$;

drop trigger if exists notify_message_recipients on public.messages;
create trigger notify_message_recipients
  after insert on public.messages
  for each row execute function public.notify_message_recipients();

create or replace function public.notify_viewing_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('confirmed', 'cancelled') then
    insert into public.alerts (user_id, type, title, body, property_id)
    values (
      new.user_id,
      'viewing',
      case when new.status = 'confirmed' then 'Viewing confirmed' else 'Viewing cancelled' end,
      case when new.status = 'confirmed' then 'Your property viewing has been confirmed.' else 'Your property viewing has been cancelled.' end,
      new.property_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_viewing_status on public.viewings;
create trigger notify_viewing_status
  after update on public.viewings
  for each row execute function public.notify_viewing_status();

create or replace function public.notify_price_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.price < old.price and new.status = 'approved' then
    insert into public.alerts (user_id, type, title, body, property_id)
    select bookmark.user_id, 'price_drop', 'Price reduced', 'A saved property has a lower asking price.', new.id
    from public.bookmarks bookmark
    where bookmark.property_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_price_drop on public.properties;
create trigger notify_price_drop
  after update of price on public.properties
  for each row execute function public.notify_price_drop();

create or replace function public.notify_listing_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    insert into public.alerts (user_id, type, title, body, property_id)
    values (new.owner_id, 'new_listing', 'Listing approved', 'Your property listing is now visible.', new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists notify_listing_approval on public.properties;
create trigger notify_listing_approval
  after update of status on public.properties
  for each row execute function public.notify_listing_approval();
