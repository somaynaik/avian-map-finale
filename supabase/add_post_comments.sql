-- Migration: Add post_comments table

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Enable RLS
alter table public.post_comments enable row level security;

-- Create Policies
create policy "Comments are viewable by everyone."
  on public.post_comments for select
  using ( true );

create policy "Users can insert their own comments."
  on public.post_comments for insert
  with check ( auth.uid() = author_id );

create policy "Users can update their own comments."
  on public.post_comments for update
  using ( auth.uid() = author_id );

create policy "Users can delete their own comments."
  on public.post_comments for delete
  using ( auth.uid() = author_id );

-- Create trigger for updated_at
drop trigger if exists post_comments_set_updated_at on public.post_comments;
create trigger post_comments_set_updated_at
  before update on public.post_comments
  for each row execute procedure public.set_updated_at();

-- Add performance indexes to prevent sequential scans
create index if not exists idx_post_comments_post_id on public.post_comments (post_id);
create index if not exists idx_post_comments_author_id on public.post_comments (author_id);
create index if not exists idx_post_comments_created_at on public.post_comments (created_at asc);
