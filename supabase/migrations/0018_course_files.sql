-- ==============================================================================
-- Migration: 0018_course_files.sql
-- Course library: every file in each Moodle course, readable by students taking that course.
-- ==============================================================================
create table if not exists public.course_files (
  course_id integer not null,
  file_url text not null,
  course_code text,
  course_short text,
  section text,
  module text,
  name text not null,
  mimetype text,
  view_url text,
  modified_at timestamptz,
  primary key (course_id, file_url)
);
create index if not exists course_files_code on public.course_files (replace(course_code, ' ', ''));
alter table public.course_files enable row level security;
drop policy if exists "classmates read course files" on public.course_files;
create policy "classmates read course files" on public.course_files for select using (
  exists (select 1 from public.user_courses uc where uc.user_id = auth.uid() and replace(uc.course_code, ' ', '') = replace(course_files.course_code, ' ', ''))
  or exists (select 1 from public.moodle_enrolments me where me.user_id = auth.uid() and me.course_id = course_files.course_id)
);
