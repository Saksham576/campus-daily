-- ==============================================================================
-- Migration: 0006_launch_features.sql
-- Verified instructor broadcasts, sponsored Today Card, web push, inactivity reminders.
-- ==============================================================================

-- Verified badge for instructor broadcasts
alter table public.items add column if not exists is_verified boolean not null default false;

-- Inactivity tracking for the 3-day reminder email
alter table public.subscribers add column if not exists last_seen_at timestamptz;
alter table public.subscribers add column if not exists last_reminded_at timestamptz;

-- Professors / TAs who may broadcast (admin approves)
create table if not exists public.broadcasters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  department text,
  role text,                                   -- 'Professor' | 'TA' | ...
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.broadcasters enable row level security;
create policy "Read own broadcaster row" on public.broadcasters for select using (user_id = auth.uid());
create policy "Request broadcaster access" on public.broadcasters for insert
  with check (user_id = auth.uid() and status = 'pending');
grant select, insert on public.broadcasters to authenticated;

-- Web push subscriptions
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "Manage own push subscriptions" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Sponsored Today Card
create table if not exists public.sponsored_cards (
  id uuid primary key default gen_random_uuid(),
  sponsor text not null,
  title text not null,
  body text,
  link text,
  active boolean not null default true,
  starts_on date not null default current_date,
  ends_on date,
  views integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.sponsored_cards enable row level security;
create policy "Authenticated read active cards" on public.sponsored_cards for select
  using (auth.role() = 'authenticated' and active);
grant select on public.sponsored_cards to authenticated;

create or replace function public.sponsored_view(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.sponsored_cards set views = views + 1 where id = p_id and active;
$$;
grant execute on function public.sponsored_view(uuid) to authenticated;

-- me_feed now also returns is_verified
drop function if exists public.me_feed(timestamptz, integer);
create function public.me_feed(
  p_since timestamptz default (now() - interval '7 days'),
  p_min_score integer default 4
)
returns table (
  id text, subject text, from_address text, received_at timestamptz, score integer,
  summary text, body text, links jsonb, tags jsonb, is_personal boolean, status text,
  venue text, deadline_at timestamptz, source text, is_verified boolean
)
language sql stable security invoker set search_path = public
as $$
  select i.id, i.subject, i.sender, i.received_at, ui.score, i.summary, i.body,
         i.links, i.tags, i.is_personal, ui.state, i.venue, i.deadline_at, i.source, i.is_verified
  from public.items i
  join public.user_items ui on ui.item_id = i.id and ui.email = public.me()
  where i.received_at >= p_since
    and (ui.score >= p_min_score or i.is_personal or i.is_verified)
    and ui.state <> 'removed'
  order by i.is_personal desc, i.is_verified desc, ui.score desc nulls last, i.received_at desc
  limit 150;
$$;
grant execute on function public.me_feed(timestamptz, integer) to authenticated;
