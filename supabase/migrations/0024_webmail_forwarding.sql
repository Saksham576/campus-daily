-- ==============================================================================
-- Migration: 0024_webmail_forwarding.sql
-- Each student's private forwarding address: campusdaily.ingest+<forward_token>@gmail.com.
-- ==============================================================================
alter table public.subscribers add column if not exists forward_token text;
alter table public.subscribers add column if not exists last_forward_at timestamptz;
create unique index if not exists subscribers_forward_token on public.subscribers (forward_token) where forward_token is not null;
