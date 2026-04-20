# Authentication Setup Guide

## 🚀 Quick Start

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" and sign up/login
3. Create a new project
4. Wait for the database to be provisioned (~2 minutes)

### 2. Get Your API Keys

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 3. Configure Environment Variables

1. Create a `.env` file in the root of your project:
   ```bash
   cp .env.example .env
   ```

2. Add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 4. Configure Email Authentication in Supabase

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Enable **Email** provider
3. Configure email templates (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize confirmation and password reset emails

### 5. Set Up Email Confirmation (Optional but Recommended)

1. Go to **Authentication** → **Settings**
2. Enable "Confirm email" under Email Auth
3. Set your site URL (e.g., `http://localhost:5173` for development)

### 6. Run the Application

```bash
npm run dev
```

Visit `http://localhost:5173` and you'll be redirected to the login page!

## 📋 Features Implemented

✅ User registration with email/password
✅ Email verification
✅ Login/logout functionality
✅ Password reset flow
✅ Protected routes (redirect to login if not authenticated)
✅ Form validation with Zod
✅ Password strength indicator
✅ Loading states and error handling
✅ Responsive design with shadcn/ui
✅ User profile with logout button

## 🔐 Security Features

- Passwords hashed with bcrypt (handled by Supabase)
- JWT tokens for authentication
- HTTP-only cookies (when configured)
- Email verification required
- Password strength requirements
- Protected API routes

## 📁 File Structure

```
src/
├── contexts/
│   └── AuthContext.tsx          # Auth state management
├── components/
│   └── ProtectedRoute.tsx       # Route protection wrapper
├── pages/
│   ├── LoginPage.tsx            # Login form
│   ├── SignupPage.tsx           # Registration form
│   ├── ForgotPasswordPage.tsx   # Password reset
│   └── ProfilePage.tsx          # User profile (updated)
├── lib/
│   └── supabase.ts              # Supabase client config
└── App.tsx                      # Routes with auth protection
```

## 🎨 Customization

### Add Social OAuth (Google, GitHub, etc.)

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable the provider you want (e.g., Google)
3. Add OAuth credentials from the provider
4. Update your login page:

```tsx
import { supabase } from '@/lib/supabase';

const signInWithGoogle = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
};
```

### Add User Profiles Table

Create a profiles table in Supabase SQL Editor:

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table profiles enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Create a trigger to create profile on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Add 2FA (Two-Factor Authentication)

Supabase supports TOTP-based 2FA:

```tsx
// Enable 2FA
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
});

// Verify 2FA
const { data, error } = await supabase.auth.mfa.verify({
  factorId: data.id,
  challengeId: challenge.id,
  code: '123456', // User's TOTP code
});
```

## 🐛 Troubleshooting

### "Invalid API key" error
- Check that your `.env` file exists and has the correct values
- Restart the dev server after creating/updating `.env`

### Email not sending
- Check Supabase email settings
- For production, configure a custom SMTP provider
- Development uses Supabase's built-in email (limited)

### Redirect issues after login
- Check your site URL in Supabase settings
- Ensure redirect URLs are whitelisted

## 🚀 Next Steps

1. **Add user profiles** - Create a profiles table and edit page
2. **Implement social features** - Follow/unfollow, friends
3. **Add file uploads** - Avatar images with Supabase Storage
4. **Set up real-time** - Live updates with Supabase Realtime
5. **Add role-based access** - Admin, moderator, user roles
6. **Implement notifications** - Email/push notifications
7. **Add activity logs** - Track user actions

## 📚 Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)
