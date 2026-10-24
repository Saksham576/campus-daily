"use client";

import { useEffect, useState } from "react";
import { FileText, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { summarizeRow } from "@/lib/docs/rows";

type Hit = { doc_id: string; name: string; course_code: string | null; page: number | null; snippet: string; view_url: string | null };
type Row = { doc_id: string; page: number | null; line: string; context?: string | null; columns?: string | null; name?: string };

/** "<<word>>" markers from the database → highlighted text (no HTML from documents is ever rendered). */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(<<[^>]*>>)/g);
  return (
    <span className="doc-snippet">
      {parts.map((p, i) => (p.startsWith("<<") ? <mark key={i}>{p.slice(2, -2)}</mark> : <span key={i}>{p}</span>))}
    </span>
  );
}

/** Matches inside course documents for the Library search box. */
export function DocHits({ q }: { q: string }) {
  const [hits, setHits] = useState<Hit[] | null>(null);
  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) return setHits(null);
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("search_docs", { q: query, lim: 20, mode: "all" });
      setHits((data || []) as Hit[]);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (!hits || hits.length === 0) return null;
  return (
    <section className="lib-group">
      <h2 className="lib-title">Inside files</h2>
      <ul className="lib-list">
        {hits.map((h, i) => (
          <li key={`${h.doc_id}-${h.page}-${i}`}>
            <a href={h.view_url || "#"} target="_blank" rel="noopener noreferrer" className="doc-hit">
              <span className="doc-hit-head">
                <FileText aria-hidden />
                <b>{h.name}</b>
                <span className="from">
                  {h.course_code ? `${h.course_code} · ` : ""}
                  {h.page ? `page ${h.page}` : ""}
                </span>
              </span>
              <Snippet text={h.snippet} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Your own lines in class lists (mess dues, marks, seating) — nobody else's. Upcoming first, finished ones tucked away. */
export function MyRows() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("personal_rows").select("doc_id, page, line, context, columns").limit(60);
      if (!data?.length) return;
      const { data: docs } = await supabase.from("documents").select("id, name").in("id", [...new Set(data.map((r) => r.doc_id))]);
      const nameOf = new Map((docs || []).map((d) => [d.id, d.name]));
      setRows(data.map((r) => ({ ...r, name: nameOf.get(r.doc_id) || "Class list" })));
    })();
  }, []);
  if (!rows.length) return null;

  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const items = rows.map((r) => ({ r, s: summarizeRow({ line: r.line, context: r.context, columns: r.columns, docName: r.name }) }));
  const isPast = (it: (typeof items)[number]) => !!it.s?.date && it.s.date < today;
  const byDate = (a: (typeof items)[number], b: (typeof items)[number]) => (a.s?.date || "9999").localeCompare(b.s?.date || "9999");
  const upcoming = items.filter((it) => !isPast(it)).sort(byDate);
  const earlier = items.filter(isPast).sort((a, b) => byDate(b, a));

  const card = ({ r, s }: (typeof items)[number], i: number) => (
    <li key={`${r.doc_id}-${r.page}-${i}`} className="doc-hit">
      {s ? (
        <>
          <span className="doc-hit-head">
            <UserRound aria-hidden />
            <b>{s.headline}</b>
          </span>
          {s.details.map((d) => (
            <span key={d} className="doc-context">
              {d}
            </span>
          ))}
          <span className="from" style={{ display: "block", marginTop: 4 }}>
            From {r.name}
            {r.page ? ", page " + r.page : ""}
          </span>
          <details className="doc-raw">
            <summary>Show the original line</summary>
            {r.columns && <span className="doc-cols mono">{r.columns}</span>}
            <span className="doc-snippet mono">{r.line}</span>
          </details>
        </>
      ) : (
        <>
          <span className="doc-hit-head">
            <UserRound aria-hidden />
            <b>{r.name}</b>
            {r.page ? <span className="from">page {r.page}</span> : null}
          </span>
          {r.context && <span className="doc-context">{r.context}</span>}
          {r.columns && <span className="doc-cols mono">{r.columns}</span>}
          <span className="doc-snippet mono">{r.line}</span>
        </>
      )}
    </li>
  );

  return (
    <section className="lib-group">
      <h2 className="lib-title">Your entries in class lists</h2>
      <ul className="lib-list">{upcoming.map(card)}</ul>
      {earlier.length > 0 && (
        <details className="doc-raw" style={{ marginTop: 8 }}>
          <summary>Earlier ({earlier.length}): exams and quizzes that are over</summary>
          <ul className="lib-list">{earlier.map(card)}</ul>
        </details>
      )}
      <p className="help" style={{ marginTop: 6 }}>Only your own row is kept from shared lists — never anyone else&apos;s.</p>
    </section>
  );
}
