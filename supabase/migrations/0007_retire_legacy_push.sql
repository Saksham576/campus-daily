-- ==============================================================================
-- Migration: 0007_retire_legacy_push.sql
-- Retire the legacy Apps Script push (items.source = 'mail'). New ingestion writes
-- 'ingest-mail' / 'whatsapp' / 'broadcast'. Legacy inserts are silently skipped.
-- Reversible: drop trigger skip_legacy_item_push on items; drop trigger skip_orphan_user_items on user_items.
-- ==============================================================================
create or replace function public.skip_legacy_item_push() returns trigger language plpgsql as $$
begin
  if new.source = 'mail' then return null; end if;
  return new;
end $$;
drop trigger if exists skip_legacy_item_push on public.items;
create trigger skip_legacy_item_push before insert on public.items
  for each row execute function public.skip_legacy_item_push();

create or replace function public.skip_orphan_user_items() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.items where id = new.item_id) then return null; end if;
  return new;
end $$;
drop trigger if exists skip_orphan_user_items on public.user_items;
create trigger skip_orphan_user_items before insert on public.user_items
  for each row execute function public.skip_orphan_user_items();
