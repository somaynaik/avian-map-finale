# 🐦 Avian Map (Feather Finder)

Avian Map (Feather Finder) is a premium, feature-rich web application built with React + Vite and Supabase, specifically designed for birdwatchers. The platform integrates real-time bird observation data, live map navigation, user-generated sightings, direct messaging, and analytical dashboards.

---

## 🚀 Features

### 🗺️ Smart Map & Live Navigation
- **eBird API Integration**: Displays real-time bird observations across India from the last 7 days.
- **Interactive Map Engine**: Built using MapLibre GL with custom marker clustering, grouping, and styling.
- **Wikipedia Media Integrations**: Asynchronously fetches and displays bird photos in both marker popups and the sidebar list. Includes a direct "Know More" hyperlink redirecting users to the bird's Wikipedia page.
- **Unified Smart Search**: Search bar uses query synonyms (e.g., searching for `"peacock"` matching `"Indian Peafowl"` or genus `"pavo"`), updating both the map pin markers and the sidebar lists simultaneously.
- **Active Navigation & Guidance**: Calculates and overlay-draws driving routes using project-OSRM routers. Features real-time `watchPosition` location tracking, auto-arrival threshold checking, step-by-step driving directions, and distance/duration labels.
- **Weather Suitability Widget**: Real-time analysis of temperature, wind, humidity, and cloud cover from Open-Meteo API. Displays a dynamic rating bar (Optimum, Fair, Not Recommended) and automatically switches to **"Not Optimal"** rating advice during night hours (8:00 PM to 6:00 AM).

### 👥 Sighting Social Feed
- **Media Sighting Posts**: Share geo-tagged media observations (supporting both image uploads and auto-playing loop videos) complete with notes, tags, and location names.
- **User Engagement**: Like posts, post comments, follow and unfollow birdwatchers, and check notification logs.

### 💬 Real-Time Direct Messaging
- **Interactive Chat**: Directly message other birdwatchers on the platform.
- **Unread Badge Alerts**: Real-time unread messages count is displayed as badges on the navigation tab bar.

### 📊 Dashboard & Analytics
- **Key Performance Indicators (KPIs)**: Instantly tracks total birds spotted, unique species count, average sighting distance (km) from your location, and peak activity days.
- **Data Visualization**: Features custom SVG-rendered line charts representing bird spotting counts over the last 7 days.
- **Static Map**: Renders a custom static mini-map centered on your location showing nearby activity density.

### 🔐 Secure Authentication Core
- **Protected Routing**: Implements secure client-side navigation using React Router DOM.
- **Password Strength Metric**: Real-time evaluation of password complexity during user registration.
- **Form Verification**: Client-side schema verification powered by React Hook Form and Zod.

---

## 💻 Tech Stack

- **Core**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Map & Geospatial**: MapLibre GL, OSRM Router API
- **State & Data Caching**: TanStack React Query v5
- **Backend & Storage**: Supabase (Auth, Database, Storage, Edge Functions)
- **Icons**: Lucide React

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_EBIRD_API_KEY=your-ebird-api-token
```

---

## 🛠️ Setup Instructions

### 1. Database Schema
Apply the SQL queries in `supabase/social_schema.sql` in the Supabase SQL Editor.

### 2. Follow Email Edge Function
The notification mail service runs via a scheduled queue using:
- `public.email_notifications` queue table
- the `follow-email` Edge Function in `supabase/functions/follow-email`
- `pg_cron` setup to fetch queue items regularly

### 3. Local Execution
Run the following script to quick-configure and launch local development:
```bash
# Windows
.\setup-auth.ps1

# Unix/macOS
chmod +x setup-auth.sh && ./setup-auth.sh
```

---

## 👨‍💻 Available Scripts

- `npm run dev` - Launches local Vite development server
- `npm run build` - Compiles production-ready build artifacts
- `npm run preview` - Runs built code locally for pre-production verification
- `npm run test` - Executes Vitest test suite
