-- ==============================================================================
-- Migration: 0015_moodle_enrolments.sql
-- The courses (and tutorial/lab groups) each student is enrolled in on Moodle.
-- ==============================================================================
create table if not exists public.moodle_enrolments (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id integer not null,
  course_code text,
  shortname text not null,
  fullname text,
  groups text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table public.moodle_enrolments enable row level security;
drop policy if exists "own enrolments" on public.moodle_enrolments;
create policy "own enrolments" on public.moodle_enrolments for select using (auth.uid() = user_id);
