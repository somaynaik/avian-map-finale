# Avian Map

Avian Map is a React + Vite application for birdwatchers. It combines live map sightings, user accounts, profiles, follows, direct messaging, and user-generated sighting posts backed by Supabase.

## Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Auth, Database, Storage, and Edge Functions
- TanStack Query

## Local Development

```sh
npm install
npm run dev
```

The app runs on `http://localhost:8080`.

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Database Setup

Apply the SQL in [supabase/social_schema.sql](/C:/Users/somay/Downloads/feather-finder-main/feather-finder-main/supabase/social_schema.sql) in the Supabase SQL Editor.

## Email Notifications

The follow notification email flow uses:

- the `public.email_notifications` queue
- the `follow-email` Supabase Edge Function in `supabase/functions/follow-email`
- a scheduled HTTP invocation via `pg_cron`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test`
