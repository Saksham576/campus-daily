-- ==============================================================================
-- Migration: 0005_me_feed_live.sql
-- The live schema stores per-student scores in user_items(email, item_id, score, state)
-- and items has (sender, venue, deadline_at, source, tags jsonb). me_feed was never
-- created live, so the web feed fell back to a query on a non-existent items.score.
-- ==============================================================================

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
  tags jsonb,
  is_personal boolean,
  status text,
  venue text,
  deadline_at timestamptz,
  source text
)
language sql
stable
security invoker
set search_path = public
as $$
  select i.id, i.subject, i.sender, i.received_at, ui.score, i.summary, i.body,
         i.links, i.tags, i.is_personal, ui.state, i.venue, i.deadline_at, i.source
  from public.items i
  join public.user_items ui on ui.item_id = i.id and ui.email = public.me()
  where i.received_at >= p_since
    and (ui.score >= p_min_score or i.is_personal)
    and ui.state <> 'removed'
  order by i.is_personal desc, ui.score desc nulls last, i.received_at desc
  limit 150;
$$;

grant execute on function public.me_feed(timestamptz, integer) to authenticated;
