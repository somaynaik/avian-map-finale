-- SQL script to insert the permanent Peregrine system profile in your database.
-- Run this script in your Supabase Dashboard SQL Editor.

insert into public.profiles (id, username, full_name, avatar_url, bio)
values (
  '00000000-0000-0000-0000-000000000000',
  'peregrine',
  'Peregrine',
  '/peregrine-avatar.jpg',
  'System birding AI assistant'
)
on conflict (id) do update
set username = 'peregrine',
    full_name = 'Peregrine',
    avatar_url = '/peregrine-avatar.jpg',
    bio = 'System birding AI assistant';
