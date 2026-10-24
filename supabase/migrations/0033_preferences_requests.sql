-- How focused the student wants their feed, and when they last chose what they follow.
alter table public.subscribers add column if not exists feed_mode text not null default 'balanced' check (feed_mode in ('focused', 'balanced', 'everything'));
alter table public.subscribers add column if not exists prefs_set_at timestamptz;

-- "What do you want next?": groups, pages or services students ask us to add, and ideas. The owner reads these in /admin.
create table if not exists public.feature_requests (
  id bigint generated always as identity primary key,
  email text not null,
  user_id uuid,
  kind text not null default 'idea' check (kind in ('group', 'service', 'idea')),
  text text not null check (char_length(text) between 3 and 1000),
  context text,
  status text not null default 'new' check (status in ('new', 'planned', 'done', 'declined')),
  created_at timestamptz not null default now()
);
create index if not exists feature_requests_created on public.feature_requests (created_at desc);
alter table public.feature_requests enable row level security;
create policy "students add their own requests" on public.feature_requests for insert to authenticated
  with check (email = lower(auth.jwt() ->> 'email'));
create policy "students read their own requests" on public.feature_requests for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));
