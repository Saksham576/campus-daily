-- ==============================================================================
-- Migration: 0008_auth_email_log.sql
-- Rate limiting for app-sent sign-in emails (service role only; no client access).
-- ==============================================================================
create table if not exists public.auth_email_log (
  id bigserial primary key,
  email text not null,
  sent_at timestamptz not null default now()
);
create index if not exists auth_email_log_email_time on public.auth_email_log (email, sent_at desc);
alter table public.auth_email_log enable row level security;
