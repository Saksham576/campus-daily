-- ==============================================================================
-- Migration: 0004_course_updates.sql
-- Course-level timetable changes detected from notices (or posted by verified
-- instructors). One row applies to every student taking that course.
-- ==============================================================================

create table if not exists public.course_updates (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,              -- e.g. 'MA 105'
  kind text not null check (kind in ('cancelled', 'moved', 'added')),
  on_date date not null,                  -- IST calendar date affected
  match_start timestamptz,                -- original slot time, if the notice named one
  new_start timestamptz,
  new_end timestamptz,
  new_location text,
  slot_type text,
  title text,
  notice_id text unique references public.items(id) on delete cascade,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists course_updates_date_idx
  on public.course_updates(on_date, course_code);

alter table public.course_updates enable row level security;

create policy "Authenticated users can read course updates"
  on public.course_updates for select
  using (auth.role() = 'authenticated');

grant select on public.course_updates to authenticated;
