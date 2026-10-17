-- ==============================================================================
-- Migration: 0022_db_cron.sql
-- Reliable schedules from inside the database: GitHub's scheduled Actions were firing only every
-- ~4 hours. pg_cron calls the app's cron routes with a key kept in the vault (never in the repo).
-- ==============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_key', 'pg_cron -> /api/cron/*');
  end if;
end $$;

create or replace function public.check_cron_key(k text) returns boolean
language sql security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'cron_key' and decrypted_secret = k);
$$;
revoke all on function public.check_cron_key(text) from public, anon, authenticated;
grant execute on function public.check_cron_key(text) to service_role;

-- Moodle reader every 15 minutes.
select cron.schedule('moodle-sync', '*/15 * * * *', $$
  select net.http_get(
    url := 'https://campusdaily.nexuspulsetech.com/api/cron/moodle',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_key')),
    timeout_milliseconds := 60000
  );
$$);
