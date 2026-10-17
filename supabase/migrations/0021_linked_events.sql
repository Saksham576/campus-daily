-- ==============================================================================
-- Migration: 0021_linked_events.sql
-- One event per real-world thing (quiz, class change, talk), linking every notice about it
-- from Moodle, email and WhatsApp. Details are resolved by source trust, newest first.
-- ==============================================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  course_code text,
  kind text not null,
  on_date date not null,
  title text not null,
  tokens text[] not null default '{}',
  start_at timestamptz,
  end_at timestamptz,
  venue text,
  cancelled boolean not null default false,
  resolved jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_day on public.events (on_date, course_code);
create table if not exists public.event_items (
  item_id text primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  claim jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists event_items_event on public.event_items (event_id);
alter table public.events enable row level security;
alter table public.event_items enable row level security;
drop policy if exists "signed-in read events" on public.events;
create policy "signed-in read events" on public.events for select to authenticated using (true);
drop policy if exists "signed-in read event items" on public.event_items;
create policy "signed-in read event items" on public.event_items for select to authenticated using (true);
