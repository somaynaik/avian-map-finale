-- Run this in the Supabase SQL Editor to add community confirmation voting for sightings.

create table if not exists public.post_confirmations (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vote text not null check (vote in ('yes', 'no')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, user_id)
);

alter table public.post_confirmations enable row level security;

drop policy if exists "post_confirmations_select_all" on public.post_confirmations;
create policy "post_confirmations_select_all"
on public.post_confirmations for select
using (true);

drop policy if exists "post_confirmations_insert_own" on public.post_confirmations;
create policy "post_confirmations_insert_own"
on public.post_confirmations for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.posts p
    where p.id = post_confirmations.post_id
      and p.author_id <> auth.uid()
  )
);

drop policy if exists "post_confirmations_update_own" on public.post_confirmations;
create policy "post_confirmations_update_own"
on public.post_confirmations for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.posts p
    where p.id = post_confirmations.post_id
      and p.author_id <> auth.uid()
  )
);

drop policy if exists "post_confirmations_delete_own" on public.post_confirmations;
create policy "post_confirmations_delete_own"
on public.post_confirmations for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists idx_post_confirmations_post_id
on public.post_confirmations (post_id);

create index if not exists idx_post_confirmations_user_id
on public.post_confirmations (user_id);
