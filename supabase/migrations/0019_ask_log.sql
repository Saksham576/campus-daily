-- ==============================================================================
-- Migration: 0019_ask_log.sql
-- Ask Campus Daily: one row per question, for the per-student daily limit.
-- ==============================================================================
create table if not exists public.ask_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  asked_at timestamptz not null default now()
);
create index if not exists ask_log_user_time on public.ask_log (user_id, asked_at desc);
alter table public.ask_log enable row level security;
drop policy if exists "own asks read" on public.ask_log;
create policy "own asks read" on public.ask_log for select using (auth.uid() = user_id);
drop policy if exists "own asks insert" on public.ask_log;
create policy "own asks insert" on public.ask_log for insert with check (auth.uid() = user_id);
