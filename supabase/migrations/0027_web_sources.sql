-- ==============================================================================
-- Migration: 0027_web_sources.sql
-- Public IITB web pages read for announcements, events and circulars. The server reads each page
-- every few hours, asks the model what is new, and files it like any other notice (source = 'web').
-- ==============================================================================
create table if not exists public.web_sources (
  id serial primary key,
  name text not null,
  url text not null unique,
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  last_hash text,
  last_filed int,
  last_error text,
  created_at timestamptz not null default now()
);
-- Server-only: no policies, so students and the public cannot read or change it.
alter table public.web_sources enable row level security;

insert into public.web_sources (name, url) values
  ('Academic Office · Circulars', 'https://acad.iitb.ac.in/circulars')
on conflict (url) do nothing;

select cron.schedule('web-sources', '*/30 * * * *', $$
  select net.http_get(
    url := 'https://campusdaily.nexuspulsetech.com/api/cron/web-sources',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_key')),
    timeout_milliseconds := 60000
  );
$$);
