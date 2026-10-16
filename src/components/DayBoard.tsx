"use client";

import { useEffect, useState } from "react";

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
  if (r.moved) return { text: "Moved", cls: "moved", phase: "next" };
  if (mins <= 45) return { text: `In ${mins} min`, cls: "soon", phase: "next" };
  return { text: "On time", cls: "go", phase: "next" };
}

/** Split-flap countdown to the next class. */
function Flaps({ text }: { text: string }) {
  return (
    <span className="flaps" aria-label={text}>
      {text.split("").map((ch, i) => (
        <span key={`${text}-${i}`} className="flap">
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

export function DayBoard({ title, rows, emptyText }: { title: string; rows: BoardRow[]; emptyText: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const next = rows.find((r) => !r.cancelled && new Date(r.end).getTime() >= now);
  const nextIn = next ? Math.max(0, Math.round((new Date(next.start).getTime() - now) / 60000)) : null;
  const countdown =
    next && nextIn !== null
      ? nextIn === 0
        ? "NOW"
        : nextIn < 60
        ? `${nextIn}M`
        : `${Math.floor(nextIn / 60)}H${String(nextIn % 60).padStart(2, "0")}`
      : null;

  return (
    <section className="board" aria-label={title}>
      <div className="board-head">
        <div className="board-title">
          {title} <span>▸</span>
        </div>
        {countdown && next && (
          <div className="small" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--board-dim)" }}>
            <span className="mono">NEXT {next.code}</span>
            <Flaps text={countdown} />
          </div>
        )}
      </div>
      <div className="board-cols" aria-hidden>
        <span>TIME</span>
        <span>COURSE</span>
        <span>NAME</span>
        <span>VENUE</span>
        <span>STATUS</span>
      </div>
      {rows.length === 0 && <div className="board-empty">{emptyText}</div>}
      {rows.map((r) => {
        const st = statusOf(r, now);
        return (
          <div key={r.id} className={`board-row ${st.phase === "past" ? "past" : st.phase === "now" ? "now" : ""}`}>
            <span className="t">{hhmm(r.start)}</span>
            <span className="c">{r.code}</span>
            <span className="n">{r.name}</span>
            <span className="v">{r.venue || "—"}</span>
            <span className={`status ${st.cls}`}>{st.text}</span>
          </div>
        );
      })}
    </section>
  );
}
