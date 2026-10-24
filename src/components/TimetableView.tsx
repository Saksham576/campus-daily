"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { toast } from "@/components/Toaster";
import { ChevronLeft, ChevronRight, Clock, MapPin, MoreHorizontal, RotateCcw, XCircle } from "lucide-react";
import { SEMESTER, WEEKS_AHEAD, WEEKS_BACK, addDays, weekInfo } from "@/lib/timetable/range";
import { istDate } from "@/lib/timetable/updates";

export type Slot = {
  id: string;
  title: string;
  location?: string | null;
  start_time: string;
  end_time?: string | null;
  slot_type: string;
  is_cancelled?: boolean;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// One steady colour per course, so a week reads at a glance.
const HUES = ["#4f6ef7", "#0f9f9a", "#8b5cf6", "#e8590c", "#d6336c", "#2f9e44", "#c08a00", "#0b7bc1"];
const hueOf = (title: string) => {
  const code = title.split(": ")[0].replace(" (Tutorial)", "");
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
};
const HOUR_PX = 56;

/** Side-by-side lanes for classes that overlap (a lecture and a lab at the same time). */
function lanes<T extends { id: string; start_time: string; end_time?: string | null }>(list: T[]) {
  const out = new Map<string, { lane: number; of: number }>();
  const sorted = [...list].sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time));
  let group: T[] = [];
  let groupEnd = -1;
  const flush = () => {
    const ends: number[] = [];
    const place = new Map<string, number>();
    for (const g of group) {
      let l = ends.findIndex((e) => e <= minutesOf(g.start_time));
      if (l < 0) l = ends.length;
      ends[l] = minutesOf(g.end_time || g.start_time);
      place.set(g.id, l);
    }
    for (const g of group) out.set(g.id, { lane: place.get(g.id)!, of: ends.length });
    group = [];
  };
  for (const x of sorted) {
    if (group.length && minutesOf(x.start_time) >= groupEnd) flush();
    group.push(x);
    groupEnd = Math.max(groupEnd, minutesOf(x.end_time || x.start_time));
  }
  flush();
  return out;
}

const ist = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000);
const minutesOf = (iso: string) => {
  const d = ist(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const dayIndex = (iso: string) => (ist(iso).getUTCDay() + 6) % 7; // 0 = Mon
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const codeOf = (title: string) => title.split(": ")[0].replace(" (Tutorial)", " · Tut");
const nameOf = (title: string) => (title.includes(": ") ? title.split(": ").slice(1).join(": ").replace(" (Tutorial)", "") : "");

/**
 * Desktop: a Mon–Fri week calendar with classes placed by time.
 * Phones: one day at a time as a list. Cancel / Restore on every class.
 */
export function TimetableView({ slots, onToggle }: { slots: Slot[]; onToggle: (id: string, cancelled?: boolean) => void }) {
  const wd = (ist(new Date().toISOString()).getUTCDay() + 6) % 7;
  const weekend = wd > 4;
  // Weekends, and weeks whose classes are all over, open on the coming week.
  const [offset, setOffset] = useState(() => {
    if (weekend) return 1;
    const w = weekInfo(0);
    const left = slots.some((s) => istDate(s.start_time) >= w.monday && istDate(s.start_time) <= w.sunday && dayIndex(s.start_time) >= wd && dayIndex(s.start_time) < 5);
    return left || !slots.some((s) => istDate(s.start_time) > w.sunday) ? 0 : 1;
  });
  const info = useMemo(() => weekInfo(offset), [offset]);
  const [open, setOpen] = useState<Slot | null>(null);
  const toggle = (s: Slot) => {
    onToggle(s.id, s.is_cancelled);
    toast(s.is_cancelled ? "Class restored" : "Marked as cancelled (only for you)", () => onToggle(s.id, !s.is_cancelled));
  };
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [noteGone, setNoteGone] = useState(true);
  useEffect(() => {
    const tick = () => setNowMin(minutesOf(new Date().toISOString()));
    tick();
    const t = setInterval(tick, 60_000);
    try {
      setNoteGone(Boolean(localStorage.getItem("cd_tt_note")));
    } catch {
      setNoteGone(false);
    }
    return () => clearInterval(t);
  }, []);
  const todayKey = ist(new Date().toISOString()).toISOString().slice(0, 10);
  const dates = useMemo(() => DAYS.map((_, i) => new Date(Date.parse(addDays(info.monday, i) + "T00:00:00Z"))), [info.monday]);
  const inWeek = useMemo(() => slots.filter((s) => istDate(s.start_time) >= info.monday && istDate(s.start_time) <= info.sunday), [slots, info]);

  // On the phone: today's tab, or the first day this week that still has classes.
  const firstBusyDay = (from: number) => {
    for (let i = from; i < 7; i++) if (inWeek.some((s) => dayIndex(s.start_time) === i)) return i;
    return Math.min(from, 4);
  };
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const day = pickedDay ?? (offset === 0 ? firstBusyDay(weekend ? 0 : wd) : firstBusyDay(0));
  const move = (n: number) => {
    setOffset((o) => Math.max(-WEEKS_BACK, Math.min(WEEKS_AHEAD, o + n)));
    setPickedDay(null);
  };
  const label = `${dates[0].getUTCDate()} ${dates[0].toLocaleString("en-IN", { month: "short", timeZone: "UTC" })} – ${dates[4].getUTCDate()} ${dates[4].toLocaleString("en-IN", { month: "short", timeZone: "UTC" })}`;

  // Mon–Fri always; Saturday / Sunday only in weeks where something is scheduled on them.
  const ncols = inWeek.some((s) => dayIndex(s.start_time) === 6) ? 7 : inWeek.some((s) => dayIndex(s.start_time) === 5) ? 6 : 5;
  const weekday = inWeek.filter((s) => dayIndex(s.start_time) < ncols);
  // Fit the grid to the hours that actually have classes (an all-afternoon week starts at 14:00), at least 6 hours tall.
  const firstH = weekday.length ? Math.min(...weekday.map((s) => Math.floor(minutesOf(s.start_time) / 60))) : 8;
  const lastH = weekday.length ? Math.max(...weekday.map((s) => Math.ceil(minutesOf(s.end_time || s.start_time) / 60))) : 18;
  const startH = Math.max(7, Math.min(firstH, lastH - 6));
  const endH = Math.max(lastH, startH + 6);
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);

  const daySlots = weekday.filter((s) => dayIndex(s.start_time) === day);
  const laneOf = useMemo(() => {
    const m = new Map<string, { lane: number; of: number }>();
    for (let i = 0; i < 7; i++) lanes(weekday.filter((s) => dayIndex(s.start_time) === i)).forEach((v, k) => m.set(k, v));
    return m;
  }, [weekday]);
  // Swipe the day list left / right to change day.
  const [touchX, setTouchX] = useState<number | null>(null);
  const swipe = (x: number) => {
    if (touchX === null || Math.abs(x - touchX) < 60) return;
    setPickedDay(Math.max(0, Math.min(ncols - 1, day + (x < touchX ? 1 : -1))));
    setTouchX(null);
  };

  const nav = (
    <div className="week-nav">
      <button type="button" className="ghost" onClick={() => move(-1)} disabled={offset <= -WEEKS_BACK} aria-label="Previous week">
        <ChevronLeft aria-hidden />
      </button>
      <b className="week-nav-label">
        {offset === 0 ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : `In ${offset} weeks`}
        <span className="muted"> · {label}</span>
      </b>
      <button type="button" className="ghost" onClick={() => move(1)} disabled={offset >= WEEKS_AHEAD} aria-label="Next week">
        <ChevronRight aria-hidden />
      </button>
      {offset !== 0 && (
        <button type="button" className="link" onClick={() => { setOffset(0); setPickedDay(null); }}>
          Today
        </button>
      )}
    </div>
  );

  return (
    <>
      {nav}
      {info.tentative && !info.afterLectures && !noteGone && (
        <p className="note tt-note" style={{ marginTop: 0 }}>
          <span>From the official slot chart; notices add changes as they arrive.</span>
          <button
            type="button"
            className="link"
            onClick={() => {
              setNoteGone(true);
              try {
                localStorage.setItem("cd_tt_note", "1");
              } catch {}
            }}
          >
            Got it
          </button>
        </p>
      )}
      {info.afterLectures && (
        <div className="empty" style={{ marginBottom: 16 }}>
          Lectures end on 6 Nov. End-semester exams run 9–21 Nov. The Academic Office publishes the exam timetable on 28 Oct —{" "}
          <a href={SEMESTER.examTimetableUrl} target="_blank" rel="noopener noreferrer">
            check it here
          </a>
          .
        </div>
      )}
      {/* Week calendar (desktop) */}
      <div className="week" role="grid" aria-label="Week calendar">
        <div className="week-head" style={{ gridTemplateColumns: `56px repeat(${ncols}, minmax(0, 1fr))` }}>
          <span />
          {dates.slice(0, ncols).map((d, i) => {
            const isToday = d.toISOString().slice(0, 10) === todayKey;
            return (
              <span key={i} className={`week-day ${isToday ? "today" : ""}`}>
                {DAYS[i]} <b>{d.getUTCDate()}</b>
              </span>
            );
          })}
        </div>
        <div className="week-body" style={{ height: hours.length * HOUR_PX, gridTemplateColumns: `56px repeat(${ncols}, minmax(0, 1fr))` }}>
          <div className="week-hours" aria-hidden>
            {hours.map((h) => (
              <span key={h} style={{ top: (h - startH) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {DAYS.slice(0, ncols).map((_, i) => (
            <div key={i} className={`week-col ${dates[i].toISOString().slice(0, 10) === todayKey ? "today" : ""}`}>
              {hours.map((h) => (
                <span key={h} className="week-line" style={{ top: (h - startH) * HOUR_PX }} />
              ))}
              {nowMin !== null && dates[i].toISOString().slice(0, 10) === todayKey && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                <span className="week-now" aria-hidden style={{ top: ((nowMin - startH * 60) / 60) * HOUR_PX }} />
              )}
              {weekday
                .filter((s) => dayIndex(s.start_time) === i)
                .map((s) => {
                  const top = ((minutesOf(s.start_time) - startH * 60) / 60) * HOUR_PX;
                  const height = Math.max(26, ((minutesOf(s.end_time || s.start_time) - minutesOf(s.start_time)) / 60) * HOUR_PX - 3);
                  const ln = laneOf.get(s.id) || { lane: 0, of: 1 };
                  return (
                    <div
                      key={s.id}
                      className={`week-block t-${s.slot_type} ${s.is_cancelled ? "cancelled" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpen(s)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(s))}
                      style={{
                        top,
                        height,
                        left: `calc(${ln.lane} * 100% / ${ln.of} + 3px)`,
                        width: `calc(100% / ${ln.of} - 6px)`,
                        right: "auto",
                        ["--c" as string]: hueOf(s.title),
                      }}
                      title={`${s.title}\n${hhmm(s.start_time)}${s.end_time ? `–${hhmm(s.end_time)}` : ""}${s.location ? ` · ${s.location}` : ""}`}
                    >
                      <b>{codeOf(s.title)}</b>
                      {height > 40 && (
                        <span>
                          {hhmm(s.start_time)}
                          {s.location ? ` · ${s.location}` : ""}
                        </span>
                      )}
                      <button
                        type="button"
                        className="week-act"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(s);
                        }}
                        aria-label={s.is_cancelled ? `Undo cancelled: ${s.title}` : `Mark ${s.title} as cancelled (only for me)`}
                        title={s.is_cancelled ? "Undo" : "Mark as cancelled (only for me)"}
                      >
                        {s.is_cancelled ? <RotateCcw /> : <XCircle />}
                      </button>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {/* Day list (phones) */}
      <div className="dayview" onTouchStart={(e) => setTouchX(e.touches[0].clientX)} onTouchEnd={(e) => swipe(e.changedTouches[0].clientX)}>
        <div className="schedule-tabs" role="tablist">
          {DAYS.slice(0, ncols).map((d, i) => (
            <button key={d} role="tab" aria-selected={day === i} className={`schedule-tab ${day === i ? "active" : ""}`} onClick={() => setPickedDay(i)}>
              <span>{d}</span> <b>{dates[i].getUTCDate()}</b>
            </button>
          ))}
        </div>
        {daySlots.length === 0 ? (
          info.afterLectures ? null : <div className="empty">Nothing scheduled on {DAYS[day]}.</div>
        ) : (
          <div className="timetable-grid">
            {daySlots.map((s) => (
              <div key={s.id} className={`slot-card ${s.slot_type} ${s.is_cancelled ? "cancelled" : ""}`} style={{ ["--c" as string]: hueOf(s.title) }}>
                <div className="slot-info" role="button" tabIndex={0} onClick={() => setOpen(s)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(s))}>
                  <h4>
                    {codeOf(s.title)}
                    {nameOf(s.title) && <span className="muted"> {nameOf(s.title)}</span>}
                  </h4>
                  <div className="slot-time">
                    <span className={`slot-pill ${s.is_cancelled ? "cancelled" : s.slot_type}`}>{s.is_cancelled ? "Cancelled" : s.slot_type}</span>
                    <span className="ico-text">
                      <Clock aria-hidden />
                      {hhmm(s.start_time)}
                      {s.end_time ? `–${hhmm(s.end_time)}` : ""}
                    </span>
                    {s.location && (
                      <span className="ico-text">
                        <MapPin aria-hidden />
                        {s.location}
                      </span>
                    )}
                  </div>
                </div>
                {s.is_cancelled ? (
                  <button type="button" className="ghost" onClick={() => toggle(s)}>
                    Undo
                  </button>
                ) : (
                  <details className="more">
                    <summary aria-label={`More options for ${s.title}`}>
                      <MoreHorizontal aria-hidden width={18} height={18} />
                    </summary>
                    <div className="more-menu">
                      <button type="button" onClick={() => toggle(s)}>
                        <XCircle aria-hidden />
                        Mark as cancelled (only for me)
                      </button>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {open && (
        <Sheet title={open.title} onClose={() => setOpen(null)}>
          <p className="eyebrow">
            {new Date(open.start_time).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}
          </p>
          <h2 className="sheet-title">
            {codeOf(open.title)}
            {nameOf(open.title) && <span className="muted"> {nameOf(open.title)}</span>}
          </h2>
          <dl className="sheet-facts">
            <dt>Time</dt>
            <dd>
              {hhmm(open.start_time)}
              {open.end_time ? `–${hhmm(open.end_time)}` : ""}
            </dd>
            <dt>Room</dt>
            <dd>{open.location || "Not announced yet"}</dd>
            <dt>Type</dt>
            <dd>{open.is_cancelled ? "Cancelled (only for you)" : open.slot_type}</dd>
          </dl>
          <div className="sheet-actions">
            <button
              type="button"
              className={open.is_cancelled ? "ghost" : ""}
              onClick={() => {
                toggle(open);
                setOpen(null);
              }}
            >
              {open.is_cancelled ? "Undo cancelled" : "Mark as cancelled (only for me)"}
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
