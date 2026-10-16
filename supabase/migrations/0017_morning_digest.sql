-- ==============================================================================
-- Migration: 0017_morning_digest.sql
-- 7:30 AM digest: how each student wants it (push by default), and when it last went out.
-- ==============================================================================
alter table public.subscribers add column if not exists digest text not null default 'push' check (digest in ('push','email','both','off'));
alter table public.subscribers add column if not exists last_digest_at timestamptz;
