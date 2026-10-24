-- Your own slots can repeat (series) and can come from a calendar import.
alter table public.user_schedules add column if not exists series_id uuid;
alter table public.user_schedules add column if not exists origin text check (origin in ('manual', 'gcal'));
create index if not exists idx_user_schedules_series on public.user_schedules (user_id, series_id) where series_id is not null;

-- A calendar's secret iCal address (Google Calendar: Settings > your calendar > Secret address in iCal format).
-- Readable only by its owner; the server re-reads it every few hours to keep the timetable in step.
create table if not exists public.calendar_feeds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  url text not null,
  slot_type text not null default 'event' check (slot_type in ('event', 'lecture', 'lab', 'custom')),
  last_sync_at timestamptz,
  last_count integer,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;
create policy "own feed read" on public.calendar_feeds for select to authenticated using (user_id = auth.uid());
create policy "own feed write" on public.calendar_feeds for insert to authenticated with check (user_id = auth.uid());
create policy "own feed update" on public.calendar_feeds for update to authenticated using (user_id = auth.uid());
create policy "own feed delete" on public.calendar_feeds for delete to authenticated using (user_id = auth.uid());
