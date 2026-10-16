-- ==============================================================================
-- Migration: 0020_moodle_connect_nonces.sql
-- One-time "passport" per Connect Moodle attempt (browser extension flow). Server-only.
-- ==============================================================================
create table if not exists public.moodle_connect_nonces (
  passport text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.moodle_connect_nonces enable row level security;
