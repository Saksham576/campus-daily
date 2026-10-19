-- A notice can cancel a whole range of days ("Buffer week: no classes this week").
alter table public.course_updates add column if not exists until_date date;
update public.course_updates set until_date = on_date where until_date is null;

create or replace function public.course_updates_default_until() returns trigger
language plpgsql as $$
begin
  new.until_date := coalesce(new.until_date, new.on_date);
  return new;
end $$;

drop trigger if exists course_updates_until on public.course_updates;
create trigger course_updates_until before insert or update on public.course_updates
  for each row execute function public.course_updates_default_until();

create index if not exists course_updates_range_idx on public.course_updates(until_date, on_date);
