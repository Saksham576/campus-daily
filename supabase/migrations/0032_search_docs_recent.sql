-- Search inside documents: newer files outrank older ones (relevance halves roughly every 60 days).
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
         c.content, d.view_url,
         (ts_rank_cd(c.tsv, query.tq) * power(0.5, greatest(extract(epoch from (now() - coalesce(d.modified_at, d.created_at))) / 86400.0, 0) / 60.0))::real as rank
  from query, public.doc_chunks c join public.documents d on d.id = c.doc_id
  where query.tq is not null and c.tsv @@ query.tq
  order by rank desc
  limit least(greatest(lim, 1), 30);
$$;
