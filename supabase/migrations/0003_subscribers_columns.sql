-- ==============================================================================
-- Migration: 0003_subscribers_columns.sql
-- Description: Add missing columns to subscribers table, backfill legacy data,
--              ensure year column is text, and configure RLS for self-management.
-- ==============================================================================

-- 1. Add missing subscriber columns
alter table public.subscribers
  add column if not exists categories text[] default '{}'::text[],
  add column if not exists keywords text,
  add column if not exists hasmed text,
  add column if not exists moodle_ical_url text,
  add column if not exists personal_email text,
  add column if not exists delivery_preference text default 'app';

-- 2. Ensure year column is text matching 0001_init.sql
alter table public.subscribers
  alter column year type text using year::text;

-- 3. Backfill existing legacy values into new columns
update public.subscribers
set
  categories = case
    when (categories is null or categories = '{}') and category is not null and trim(category) <> ''
      then (
        select coalesce(array_agg(trim(elem)), '{}'::text[])
        from unnest(string_to_array(category, ',')) as elem
        where trim(elem) <> ''
      )
    when categories is null or categories = '{}'
      then '{}'::text[]
    else categories
  end,
  keywords = coalesce(keywords, interests),
  hasmed = coalesce(hasmed, hasmed1),
  moodle_ical_url = coalesce(moodle_ical_url, moodle_ical),
  personal_email = coalesce(personal_email, delivery_email),
  delivery_preference = case
    when delivery = 'app_email' then 'both'
    else coalesce(delivery_preference, delivery, 'app')
  end;

-- 4. Ensure RLS policies allow authenticated users to manage their own subscriber profile
drop policy if exists "sub_self_update" on public.subscribers;
drop policy if exists "Users manage own subscriber profile" on public.subscribers;

create policy "Users manage own subscriber profile"
  on public.subscribers
  for all
  to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or user_id = auth.uid()
    or lower(email) = lower(public.me())
  )
  with check (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or user_id = auth.uid()
    or lower(email) = lower(public.me())
  );

grant select, insert, update on public.subscribers to authenticated;

-- 5. Refresh PostgREST schema cache
notify pgrst, 'reload schema';
