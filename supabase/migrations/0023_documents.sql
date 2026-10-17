-- ==============================================================================
-- Migration: 0023_documents.sql
-- Document library: text inside Moodle files, mail attachments and WhatsApp documents,
-- searchable by the students who can see them. Class lists (mess dues, marks, seating) are never
-- stored whole — each student only gets the lines with their own roll number (personal_rows).
-- ==============================================================================

create table if not exists public.documents (
  id text primary key,
  source text not null check (source in ('moodle', 'mail', 'whatsapp')),
  course_id integer,
  course_code text,
  item_id text,                 -- the notice it came with (mail / WhatsApp)
  name text not null,
  mime text,
  file_url text,                -- Moodle pluginfile URL (needs a student's key to download)
  storage_path text,            -- attachments bucket path (mail / WhatsApp)
  view_url text,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed', 'skipped')),
  method text,                  -- text | ai
  is_roster boolean not null default false,
  pages integer,
  chars integer,
  tries integer not null default 0,
  error text,
  modified_at timestamptz,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists documents_pending on public.documents (status, created_at desc) where status = 'pending';
create index if not exists documents_course on public.documents (course_id);
create index if not exists documents_item on public.documents (item_id);

create table if not exists public.doc_chunks (
  doc_id text not null references public.documents(id) on delete cascade,
  idx integer not null,
  page integer,
  content text not null,
  tsv tsvector generated always as (to_tsvector('english', content)) stored,
  primary key (doc_id, idx)
);
create index if not exists doc_chunks_tsv on public.doc_chunks using gin (tsv);

create table if not exists public.personal_rows (
  doc_id text not null references public.documents(id) on delete cascade,
  roll text not null,
  page integer,
  line text not null
);
create index if not exists personal_rows_roll on public.personal_rows (roll);

-- Who may see a document: students in its Moodle course, or students who received its notice.
create or replace function public.can_see_document(d public.documents) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    (d.course_id is not null and (
      exists (select 1 from public.moodle_enrolments me where me.user_id = auth.uid() and me.course_id = d.course_id)
      or exists (select 1 from public.user_courses uc where uc.user_id = auth.uid()
                 and replace(uc.course_code, ' ', '') = replace(coalesce(d.course_code, ''), ' ', ''))
    ))
    or (d.item_id is not null and exists (
      select 1 from public.user_items ui where ui.item_id = d.item_id and ui.email = lower(auth.jwt() ->> 'email')
    ));
$$;

alter table public.documents enable row level security;
alter table public.doc_chunks enable row level security;
alter table public.personal_rows enable row level security;

drop policy if exists "see documents" on public.documents;
create policy "see documents" on public.documents for select using (public.can_see_document(documents));

drop policy if exists "see chunks" on public.doc_chunks;
create policy "see chunks" on public.doc_chunks for select using (
  exists (select 1 from public.documents d where d.id = doc_chunks.doc_id and not d.is_roster and public.can_see_document(d))
);

-- Your own rows only, matched by the roll number in your IITB email.
drop policy if exists "own rows" on public.personal_rows;
create policy "own rows" on public.personal_rows for select using (
  roll = lower(split_part(auth.jwt() ->> 'email', '@', 1))
);

-- Search inside documents (RLS applies). mode 'all' = every word (Library box), 'any' = best matches (Ask).
create or replace function public.search_docs(q text, lim integer default 8, mode text default 'all')
returns table (doc_id text, name text, course_code text, page integer, snippet text, content text, view_url text, rank real)
language sql stable security invoker set search_path = public as $$
  with query as (
    select case when mode = 'any'
      then nullif(array_to_string(tsvector_to_array(to_tsvector('english', q)), ' | '), '')::tsquery
      else websearch_to_tsquery('english', q) end as tq
  )
  select c.doc_id, d.name, d.course_code, c.page,
         ts_headline('english', c.content, query.tq, 'MaxWords=35, MinWords=12, MaxFragments=2, StartSel=<<, StopSel=>>') as snippet,
         c.content, d.view_url, ts_rank_cd(c.tsv, query.tq) as rank
  from query, public.doc_chunks c join public.documents d on d.id = c.doc_id
  where query.tq is not null and c.tsv @@ query.tq
  order by rank desc
  limit least(greatest(lim, 1), 30);
$$;

-- Attachments from mail / WhatsApp (private; the server reads them with the service role).
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false) on conflict (id) do nothing;

-- Read pending documents every 10 minutes (key from the vault, see 0022).
select cron.schedule('docs-read', '*/10 * * * *', $$
  select net.http_get(
    url := 'https://campusdaily.nexuspulsetech.com/api/cron/docs',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_key')),
    timeout_milliseconds := 60000
  );
$$);
