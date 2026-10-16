-- ==============================================================================
-- Migration: 0016_moodle_deadlines.sql
-- Each student's own upcoming Moodle deadlines (assignments, quizzes), from their calendar.
-- ==============================================================================
create table if not exists public.moodle_deadlines (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id integer not null,
  course_code text,
  course_name text,
  name text not null,
  kind text, -- assign / quiz / other module name
  due_at timestamptz not null,
  url text,
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.moodle_deadlines enable row level security;
drop policy if exists "own deadlines" on public.moodle_deadlines;
create policy "own deadlines" on public.moodle_deadlines for select using (auth.uid() = user_id);
