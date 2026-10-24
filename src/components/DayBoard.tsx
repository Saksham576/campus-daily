"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

export type BoardRow = {
  id: string;
  start: string; // ISO
  end: string; // ISO
  code: string;
  name: string;
  venue: string;
  cancelled?: boolean;
  moved?: boolean;
};

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

function statusOf(r: BoardRow, now: number): { text: string; cls: string; phase: "past" | "now" | "next" } {
  const s = new Date(r.start).getTime();
  const e = new Date(r.end).getTime();
  if (r.cancelled) return { text: "Cancelled", cls: "stop", phase: e < now ? "past" : "next" };
  if (e < now) return { text: "Done", cls: "done", phase: "past" };
  if (s <= now) return { text: "Now", cls: "go", phase: "now" };
  const mins = Math.round((s - now) / 60000);
  if (r.moved) return { text: "Changed", cls: "moved", phase: "next" };
  if (mins <= 45) return { text: `In ${mins} min`, cls: "soon", phase: "next" };
  return { text: "", cls: "", phase: "next" };
}

/** Today's classes as a quiet timeline; the current one is highlighted. */
export function DayBoard({ title, rows, emptyText, note }: { title: string; rows: BoardRow[]; emptyText: string; note?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  // On phones the card starts as one line (the class that is on or next); "Full day" opens the rest.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const next = rows.find((r) => !r.cancelled && new Date(r.end).getTime() >= now);
  const nextIn = next ? Math.max(0, Math.round((new Date(next.start).getTime() - now) / 60000)) : null;
  const nextText =
    next && nextIn !== null
      ? nextIn === 0
        ? "on now"
        : nextIn < 60
        ? `in ${nextIn} min`
        : nextIn < 24 * 60
        ? `in ${Math.floor(nextIn / 60)} h ${nextIn % 60 ? `${nextIn % 60} min` : ""}`.trim()
        : `at ${hhmm(next.start)}`
      : null;

  return (
    <section className={`today ${open ? "open" : ""}`} aria-label={title}>
      <div className="today-head">
        <span className="today-title">{title}</span>
        {!next && rows.length > 0 && <span className="today-next">Done for today</span>}
        {next && nextText && (
          <span className="today-next">
            <b>{next.code}</b> {nextText}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="board-empty">{emptyText}</div>
      ) : (
        <ul className="today-list">
          {rows.map((r) => {
            const st = statusOf(r, now);
            return (
              <li key={r.id} className={`today-row ${st.phase} ${r.cancelled ? "cancelled" : ""} ${next && r.id === next.id ? "focus" : ""}`}>
                <span className="t">{hhmm(r.start)}</span>
                <span className="bar" aria-hidden />
                <span className="what">
                  <span className="c">{r.code}</span>
                  <span className="n">
                    {r.name}
                    {r.venue ? ` · ${r.venue}` : ""}
                  </span>
                </span>
                {st.text ? <span className={`status ${st.cls}`}>{st.text}</span> : <span />}
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 1 && (
        <button type="button" className="today-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide full day" : `Full day (${rows.length})`}
          <ChevronDown aria-hidden />
        </button>
      )}
      {note && rows.length > 0 && <p className="today-note">{note}</p>}
    </section>
  );
}
