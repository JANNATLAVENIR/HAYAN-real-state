-- Chat messages are delivered in the Chat inbox, not duplicated in Alerts.
-- Keep existing alert rows intact; the app filters legacy message alerts out.
drop trigger if exists notify_message_recipients on public.messages;
