-- ==============================================================================
-- Migration: 0010_user_courses.sql
-- Each student's real courses (from ResoBin / ASC); the timetable is built from these
-- plus the IITB slot chart (src/lib/timetable/slots.ts).
-- ==============================================================================
create table if not exists public.user_courses (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_code text not null,
  title text,
  division text,
  lecture_slots text[] not null default '{}',
  tutorial_slots text[] not null default '{}',
  venue text,
  created_at timestamptz not null default now(),
  primary key (user_id, course_code)
);
alter table public.user_courses enable row level security;
create policy "Manage own courses" on public.user_courses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.user_courses to authenticated;
