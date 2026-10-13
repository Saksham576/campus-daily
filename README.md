# Campus Daily 📰📅

> **Your campus notices and self-updating timetable, ranked and personalized for IIT Bombay students.**

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green.svg)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-blue.svg)](https://campusdaily.nexuspulsetech.com)

---

## 1. Product Overview

IIT Bombay students receive 40–60 emails daily across 10+ official mailing lists (academic notices, placement cell, departments, hostels, clubs, gymkhana, admin). Important updates—such as class cancellations, tutorial venue shifts, quiz announcements, HASMED division allocations, and NCC/NSO/NSS updates—are easily missed.

**Campus Daily** solves this with two foundational layers:
1. **Intelligent Notice Feed (`/`)**: Relevance-scored (1–10) chronological digest filtered by department, program year, division, hostel, and interests.
2. **Self-Updating Timetable (`/schedule`)**: Automatically extracts event timings, venues, and cancellations from notices into an interactive weekly timetable with 1-tap `.ics` calendar sync for phones and Google Calendar.

---

## 2. Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components, TypeScript)
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security, Magic Link Auth restricted to `@*.iitb.ac.in`)
- **Hosting**: Vercel Mumbai region (`bom1`) at [`https://campusdaily.nexuspulsetech.com`](https://campusdaily.nexuspulsetech.com)
- **Ingestion**: Google Apps Script / Ingestion worker parsing mailing lists with Gemini 2.5 Flash Lite

---

## 3. Project Structure

```
campus-daily/
├── apps-script/
│   └── Supabase.gs                 # Google Apps Script bridge syncing notices to Supabase
├── src/
│   ├── app/
│   │   ├── auth/callback/route.ts  # Supabase OAuth/Magic Link session exchange
│   │   ├── login/page.tsx          # Passwordless login restricted to @iitb.ac.in
│   │   ├── settings/page.tsx       # Profile, Division, HASMED, and Moodle iCal sync
│   │   ├── schedule/page.tsx       # Weekly visual timetable & cancellation manager
│   │   ├── page.tsx                # Main 7-day personalized notice feed
│   │   ├── layout.tsx              # Root HTML & styling wrapper
│   │   └── globals.css             # High-contrast publication theme
│   ├── components/
│   │   └── ItemCard.tsx            # Notice card with 1-tap timetable & .ics export
│   └── lib/
│       ├── constants.ts            # IITB Departments, Hostels, Divisions, HASMED
│       ├── events.ts               # Structured event & cancellation extractor, .ics builder
│       ├── timetable/
│       │   └── first_year_slots.ts # IITB baseline D1–D4 academic timetable slots
│       └── supabase/
│           ├── client.ts           # Browser Supabase client
│           ├── server.ts           # Server Components Supabase client
│           └── middleware.ts       # Edge auth refresh & domain verification
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql           # Schema for subscribers, items, user_items
│       └── 0002_schedule.sql       # Schema for user_schedules & notice_interactions
├── package.json
└── tsconfig.json
```

---

## 4. Local Development

### Prerequisites
- Node.js 18+ (tested on Node v24)
- npm or pnpm

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Saksham576/campus-daily.git
   cd campus-daily
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://bcqzlxftcsgjmgaddqjz.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_KxKyxsC0GKUM3pq1LyX4-A_FxbuQncZ
   ```
4. Run development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000).

---

## 5. Database Migrations

Apply migrations to your Supabase project via the Supabase Dashboard SQL Editor or Supabase CLI:
- `supabase/migrations/0001_init.sql`: Creates `public.subscribers`, `public.items`, `public.user_items`, and RPC functions.
- `supabase/migrations/0002_schedule.sql`: Creates `public.user_schedules` (for student class & quiz slots) and `public.notice_interactions` (for ML ranking telemetry).
