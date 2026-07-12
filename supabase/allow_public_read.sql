-- Migration: Allow public (anon) read access to posts, profiles, and post_likes for guest viewing
-- Drop existing policies that restrict select to authenticated users only
drop policy if exists "posts_select_all" on public.posts;
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "post_likes_select_all" on public.post_likes;

-- Create new policies allowing public select access (both anon and authenticated)
create policy "posts_select_all"
on public.posts for select
using (true);

create policy "profiles_select_all"
on public.profiles for select
using (true);

create policy "post_likes_select_all"
on public.post_likes for select
using (true);
