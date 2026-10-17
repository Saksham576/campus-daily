-- ==============================================================================
-- Migration: 0025_backfill_my_feed.sql
-- New students start with an empty feed (scores are written when a notice arrives).
-- Give the caller the last 3 weeks of shared notices, scored like classmates in the
-- same department + year. Called at the end of setup and on Home when the feed is empty.
-- Also: sponsor view counter is for signed-in users only.
-- ==============================================================================
create or replace function public.backfill_my_feed(p_days int default 21)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.subscribers;
  n int;
begin
  select * into me from public.subscribers where email = lower(coalesce(auth.jwt() ->> 'email', '')) and merged_into is null;
  if not found then return 0; end if;

  with cand as (
    select ui.item_id
    from public.user_items ui
    join public.items i on i.id = ui.item_id
    where i.received_at > now() - make_interval(days => least(greatest(p_days, 1), 30))
    group by ui.item_id
    having count(*) >= 3 and not bool_or(ui.email = me.email)
  ),
  scored as (
    select c.item_id,
      coalesce(
        (select round(avg(u.score)) from public.user_items u join public.subscribers s on s.email = u.email
          where u.item_id = c.item_id and s.department = me.department and s.year = me.year),
        (select round(avg(u.score)) from public.user_items u join public.subscribers s on s.email = u.email
          where u.item_id = c.item_id and s.year = me.year),
        (select percentile_disc(0.5) within group (order by u.score) from public.user_items u where u.item_id = c.item_id)
      )::int as score
    from cand c
  )
  insert into public.user_items (email, item_id, score, state, scored_by)
  select me.email, item_id, score, 'new', 'backfill' from scored
  on conflict (email, item_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.backfill_my_feed(int) from public, anon;
grant execute on function public.backfill_my_feed(int) to authenticated;

revoke execute on function public.sponsored_view(uuid) from anon, public;
grant execute on function public.sponsored_view(uuid) to authenticated;
