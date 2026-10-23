-- A notice can be aimed at one division ("doubt session for D4") and one notice can make several changes
-- ("no more lectures" + "doubt session Friday"), so a notice may own several course_updates rows.
alter table public.course_updates add column if not exists division text;
drop index if exists public.course_updates_notice_id_key;
alter table public.course_updates drop constraint if exists course_updates_notice_id_key;
create unique index if not exists course_updates_notice_change
  on public.course_updates (notice_id, kind, on_date, slot_type, division) nulls not distinct;
