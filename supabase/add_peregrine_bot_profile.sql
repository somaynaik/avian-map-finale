-- SQL script to insert the permanent Peregrine system profile in your database.
-- Run this script in your Supabase Dashboard SQL Editor.

-- 1. Insert system user into auth.users to satisfy the foreign key constraint
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, aud, role)
values (
  '00000000-0000-0000-0000-000000000000',
  'peregrine@avianmap.system',
  '{"username": "peregrine", "full_name": "Peregrine"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  'authenticated',
  'authenticated'
)
on conflict (id) do nothing;

-- 2. Upsert the profile table with exact bot parameters
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
