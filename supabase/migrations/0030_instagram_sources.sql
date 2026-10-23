-- Club and council Instagram accounts whose public posts are read (official Business Discovery API).
-- Server-only: no policies. Inactive until INSTAGRAM_TOKEN and INSTAGRAM_USER_ID are set in Vercel.
create table if not exists public.instagram_sources (
  id serial primary key,
  handle text not null unique,
  note text,
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  last_posted_at text,
  last_filed int,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.instagram_sources enable row level security;

select cron.schedule('instagram', '17 */2 * * *', $$
  select net.http_get(
    url := 'https://campusdaily.nexuspulsetech.com/api/cron/instagram',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_key')),
    timeout_milliseconds := 60000
  );
$$);
