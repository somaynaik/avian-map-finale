create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  species_name text not null,
  location_name text,
  note text,
  image_url text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, user_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
begin
  base_username := lower(
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1),
      'birder'
    )
  );

  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    base_username || '_' || left(replace(new.id::text, '-', ''), 6),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.follows enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.email_notifications enable row level security;

alter table public.profiles
add column if not exists new_follower_email_notifications boolean not null default true;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all"
on public.posts for select
to authenticated
using (true);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
on public.posts for insert
to authenticated
with check (auth.uid() = author_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
on public.posts for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
on public.posts for delete
to authenticated
using (auth.uid() = author_id);

drop policy if exists "post_likes_select_all" on public.post_likes;
create policy "post_likes_select_all"
on public.post_likes for select
to authenticated
using (true);

drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own"
on public.post_likes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own"
on public.post_likes for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "follows_select_all" on public.follows;
create policy "follows_select_all"
on public.follows for select
to authenticated
using (true);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
on public.follows for insert
to authenticated
with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
on public.follows for delete
to authenticated
using (auth.uid() = follower_id);

drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant"
on public.conversations for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "conversations_insert_authenticated" on public.conversations;
create policy "conversations_insert_authenticated"
on public.conversations for insert
to authenticated
with check (true);

drop policy if exists "participants_select_participant" on public.conversation_participants;
create policy "participants_select_participant"
on public.conversation_participants for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "participants_insert_self_or_existing_participant" on public.conversation_participants;
create policy "participants_insert_self_or_existing_participant"
on public.conversation_participants for insert
to authenticated
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
  )
  or not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_participants.conversation_id
  )
);

drop policy if exists "participants_update_own" on public.conversation_participants;
create policy "participants_update_own"
on public.conversation_participants for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_insert_participant"
on public.messages for insert
to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "email_notifications_service_only" on public.email_notifications;
create policy "email_notifications_service_only"
on public.email_notifications for all
to authenticated
using (false)
with check (false);

create or replace function public.queue_new_follower_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.profiles p
    where p.id = new.following_id
      and p.new_follower_email_notifications = true
  ) then
    insert into public.email_notifications (
      type,
      recipient_user_id,
      actor_user_id,
      payload
    )
    values (
      'new_follower',
      new.following_id,
      new.follower_id,
      jsonb_build_object('followed_at', new.created_at)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists follows_queue_new_follower_email on public.follows;
create trigger follows_queue_new_follower_email
after insert on public.follows
for each row execute procedure public.queue_new_follower_email();

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
on storage.objects for select
to public
using (bucket_id = 'media');

drop policy if exists "media_authenticated_upload" on storage.objects;
create policy "media_authenticated_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = 'posts'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

drop policy if exists "media_authenticated_update" on storage.objects;
create policy "media_authenticated_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = 'posts'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
)
with check (
  bucket_id = 'media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = 'posts'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

drop policy if exists "media_authenticated_delete" on storage.objects;
create policy "media_authenticated_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = 'posts'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);
