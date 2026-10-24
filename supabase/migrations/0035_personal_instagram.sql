-- Students can follow Instagram pages of their own. Their posts are shown to that student only.
-- Free tier friendly: three pages each, forty in all, and each page is read with the same one API call as the shared ones.
alter table public.instagram_sources add column if not exists owner_email text;
alter table public.instagram_sources drop constraint if exists instagram_sources_handle_key;
create unique index if not exists instagram_sources_handle_owner on public.instagram_sources (handle, coalesce(owner_email, ''));
alter table public.instagram_sources add constraint instagram_handle_format check (handle ~ '^[a-z0-9._]{1,30}$') not valid;

create policy "students read their own pages" on public.instagram_sources for select to authenticated
  using (owner_email = lower(auth.jwt() ->> 'email'));
create policy "students add their own pages" on public.instagram_sources for insert to authenticated
  with check (owner_email = lower(auth.jwt() ->> 'email') and enabled);
create policy "students remove their own pages" on public.instagram_sources for delete to authenticated
  using (owner_email = lower(auth.jwt() ->> 'email'));

create or replace function public.limit_personal_instagram() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_email is null then return new; end if;
  if (select count(*) from public.instagram_sources where owner_email = new.owner_email) >= 3 then
    raise exception 'You can follow up to 3 Instagram pages of your own.';
  end if;
  if (select count(*) from public.instagram_sources where owner_email is not null) >= 40 then
    raise exception 'Personal Instagram pages are full for now. Ask us to add it for everyone instead.';
  end if;
  return new;
end $$;
drop trigger if exists limit_personal_instagram on public.instagram_sources;
create trigger limit_personal_instagram before insert on public.instagram_sources for each row execute function public.limit_personal_instagram();
