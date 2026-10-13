-- ==============================================================================
-- Migration: 0001_init.sql
-- Description: Core Schema for Campus Daily (Subscribers, Items, User Feedback)
-- ==============================================================================

-- gen_random_uuid() is built into Postgres 13+ (Supabase)

-- 1. Subscribers table (Stores user profile, division, HASMED elective, preferences)
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  department text,
  year text,
  division text,
  hostel text,
  hasmed text,
  categories text[] default '{}'::text[],
  keywords text,
  personal_email text,
  delivery_preference text default 'app' check (delivery_preference in ('app', 'email', 'both')),
  moodle_ical_url text,
  onboarded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Items table (Parsed & Scored Notices from Email Ingestion)
create table if not exists public.items (
  id text primary key,
  subject text not null,
  from_address text,
  received_at timestamptz default now(),
  score integer default 0,
  summary text,
  body text,
  links jsonb default '[]'::jsonb,
  tags text[] default '{}'::text[],
  is_personal boolean default false,
  target_departments text[] default '{}'::text[],
  target_years text[] default '{}'::text[],
  target_hostels text[] default '{}'::text[],
  created_at timestamptz default now()
);

-- 3. User Items Interaction table (Keep / Remove state per user)
create table if not exists public.user_items (
  user_id uuid references auth.users(id) on delete cascade not null,
  item_id text references public.items(id) on delete cascade not null,
  status text default 'new' check (status in ('new', 'kept', 'removed')),
  interacted_at timestamptz default now(),
  primary key (user_id, item_id)
);

-- 4. Helper Function: Get current authenticated user's email
create or replace function public.me()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.jwt() ->> 'email',
    ''
  );
$$;

-- 5. Helper Function: Get personalized feed items for the current authenticated user
create or replace function public.me_feed(
  p_since timestamptz default (now() - interval '7 days'),
  p_min_score integer default 4
)
returns table (
  id text,
  subject text,
  from_address text,
  received_at timestamptz,
  score integer,
  summary text,
  body text,
  links jsonb,
  tags text[],
  is_personal boolean,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.me();
begin
  return query
  select
    i.id,
    i.subject,
    i.from_address,
    i.received_at,
    i.score,
    i.summary,
    i.body,
    i.links,
    i.tags,
    i.is_personal,
    coalesce(ui.status, 'new') as status
  from public.items i
  left join public.user_items ui
    on ui.item_id = i.id and ui.user_id = v_uid
  where
    i.received_at >= p_since
    and (
      i.score >= p_min_score
      or i.is_personal = true
    )
    and coalesce(ui.status, 'new') != 'removed'
  order by
    i.is_personal desc,
    i.score desc,
    i.received_at desc
  limit 150;
end;
$$;

-- 6. Row Level Security Policies
alter table public.subscribers enable row level security;
alter table public.items enable row level security;
alter table public.user_items enable row level security;

-- Subscribers: Authenticated users can view and update their own subscriber row
create policy "Users manage own subscriber profile"
  on public.subscribers
  for all
  using (email = public.me());

-- Items: Authenticated users can read notices
create policy "Authenticated users can read items"
  on public.items
  for select
  using (auth.role() = 'authenticated');

-- User Items: Authenticated users manage their own kept/removed statuses
create policy "Users manage own item interactions"
  on public.user_items
  for all
  using (auth.uid() = user_id);

-- Explicit Grants
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.subscribers to authenticated;
grant select on public.items to authenticated;
grant select, insert, update on public.user_items to authenticated;
grant execute on function public.me() to authenticated;
grant execute on function public.me_feed(timestamptz, integer) to authenticated;
