-- SQL script to allow deleting/clearing chats and blocking users.
-- Copy and run this script in your Supabase Dashboard SQL Editor.

-- 1. Enable RLS DELETE policies for conversations and messages
drop policy if exists "conversations_delete_participant" on public.conversations;
create policy "conversations_delete_participant"
on public.conversations for delete
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "messages_delete_participant" on public.messages;
create policy "messages_delete_participant"
on public.messages for delete
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

-- 2. Create the blocks table mapping
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

-- 3. Enable RLS on blocks and add select, insert, delete policies
alter table public.blocks enable row level security;

drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own"
on public.blocks for select
to authenticated
using (auth.uid() = blocker_id);

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own"
on public.blocks for insert
to authenticated
with check (auth.uid() = blocker_id);

drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own"
on public.blocks for delete
to authenticated
using (auth.uid() = blocker_id);
