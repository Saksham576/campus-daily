-- ==============================================================================
-- Migration: 0002_schedule.sql
-- Description: Phase 2 Core Schedule & Timetable Layer + Notice Interactions
-- ==============================================================================

-- 1. Create user_schedules table for class, quiz, exam, and event slots
create table if not exists public.user_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  notice_id text references public.items(id) on delete set null,
  moodle_uid text,
  title text not null,
  location text,
  start_time timestamptz not null,
  end_time timestamptz,
  slot_type text check (slot_type in ('lecture', 'lab', 'quiz', 'exam', 'deadline', 'event', 'custom')) not null,
  is_cancelled boolean default false,
  rrule text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for fast retrieval & deduplication
create index if not exists idx_user_schedules_user_time
  on public.user_schedules(user_id, start_time);

create index if not exists idx_user_schedules_dedup
  on public.user_schedules(user_id, title, start_time);

-- 2. Create notice_interactions table for feedback & machine learning tuning
create table if not exists public.notice_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  notice_id text references public.items(id) on delete cascade not null,
  action text check (action in ('view', 'add_to_calendar', 'dismiss', 'keep', 'dislike')) not null,
  created_at timestamptz default now()
);

create index if not exists idx_notice_interactions_user_notice
  on public.notice_interactions(user_id, notice_id);

-- 3. Row Level Security
alter table public.user_schedules enable row level security;
alter table public.notice_interactions enable row level security;

-- user_schedules: users can select, insert, update, delete their own slots
create policy "Users manage own schedules"
  on public.user_schedules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- notice_interactions: users manage own interactions
create policy "Users manage own interactions"
  on public.notice_interactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Explicit Grants
grant select, insert, update, delete on public.user_schedules to authenticated;
grant select, insert, update, delete on public.notice_interactions to authenticated;
