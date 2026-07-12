-- Migration: Add missing notification columns and setup message email trigger
-- 1. Ensure columns exist with default true
alter table public.profiles
add column if not exists new_follower_email_notifications boolean not null default true;

alter table public.profiles
add column if not exists new_message_email_notifications boolean not null default true;

-- 2. Update existing users to make sure they have notification defaults enabled
update public.profiles
set 
  new_follower_email_notifications = coalesce(new_follower_email_notifications, true),
  new_message_email_notifications = coalesce(new_message_email_notifications, true);

-- 3. Recreate trigger function
create or replace function public.queue_new_message_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
begin
  -- Find the recipient of the message
  select cp.user_id into recipient_id
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id != new.sender_id
  limit 1;

  if recipient_id is not null and exists (
    select 1
    from public.profiles p
    where p.id = recipient_id
      and p.new_message_email_notifications = true
  ) then
    insert into public.email_notifications (
      type,
      recipient_user_id,
      actor_user_id,
      payload
    )
    values (
      'new_message',
      recipient_id,
      new.sender_id,
      jsonb_build_object(
        'message_id', new.id,
        'conversation_id', new.conversation_id,
        'body', new.body
      )
    );
  end if;

  return new;
end;
$$;

-- 4. Recreate trigger on messages table
drop trigger if exists messages_queue_new_message_email on public.messages;
create trigger messages_queue_new_message_email
after insert on public.messages
for each row execute procedure public.queue_new_message_email();
