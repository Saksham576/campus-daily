"use client";

import { useMemo, useState } from "react";
import { Clock, MapPin, RotateCcw, XCircle } from "lucide-react";

export type Slot = {
  id: string;
  title: string;
  location?: string | null;
  start_time: string;
  end_time?: string | null;
  slot_type: string;
  is_cancelled?: boolean;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
// One steady colour per course, so a week reads at a glance.
const HUES = ["#4f6ef7", "#0f9f9a", "#8b5cf6", "#e8590c", "#d6336c", "#2f9e44", "#c08a00", "#0b7bc1"];
const hueOf = (title: string) => {
  const code = title.split(": ")[0].replace(" (Tutorial)", "");
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
};
const HOUR_PX = 56;

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

/** Mon–Fri dates of the week the slots belong to (IST), for the column headers. */
function weekDates(slots: Slot[]): Date[] {
  const ref = slots[0] ? ist(slots[0].start_time) : ist(new Date().toISOString());
  const monday = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - ((ref.getUTCDay() + 6) % 7)));
  return DAYS.map((_, i) => new Date(monday.getTime() + i * 86400_000));
}

/**
 * Desktop: a Mon–Fri week calendar with classes placed by time.
 * Phones: one day at a time as a list. Cancel / Restore on every class.
 */
export function TimetableView({ slots, onToggle }: { slots: Slot[]; onToggle: (id: string, cancelled?: boolean) => void }) {
  const wd = (ist(new Date().toISOString()).getUTCDay() + 6) % 7;
  const todayIdx = wd > 4 ? 0 : wd; // weekends open on Monday of the coming week
  const [day, setDay] = useState(todayIdx);
  const dates = useMemo(() => weekDates(slots), [slots]);
  const todayKey = ist(new Date().toISOString()).toISOString().slice(0, 10);

  const weekday = slots.filter((s) => dayIndex(s.start_time) < 5);
  const startH = Math.min(8, ...weekday.map((s) => Math.floor(minutesOf(s.start_time) / 60)));
  const endH = Math.max(18, ...weekday.map((s) => Math.ceil(minutesOf(s.end_time || s.start_time) / 60)));
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);

  const daySlots = weekday.filter((s) => dayIndex(s.start_time) === day);

  return (
    <>
      {/* Week calendar (desktop) */}
      <div className="week" role="grid" aria-label="This week">
        <div className="week-head">
          <span />
          {dates.map((d, i) => {
            const isToday = d.toISOString().slice(0, 10) === todayKey;
            return (
              <span key={i} className={`week-day ${isToday ? "today" : ""}`}>
                {DAYS[i]} <b>{d.getUTCDate()}</b>
              </span>
            );
          })}
        </div>
        <div className="week-body" style={{ height: hours.length * HOUR_PX }}>
          <div className="week-hours" aria-hidden>
            {hours.map((h) => (
              <span key={h} style={{ top: (h - startH) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {DAYS.map((_, i) => (
            <div key={i} className={`week-col ${dates[i].toISOString().slice(0, 10) === todayKey ? "today" : ""}`}>
              {hours.map((h) => (
                <span key={h} className="week-line" style={{ top: (h - startH) * HOUR_PX }} />
              ))}
              {weekday
                .filter((s) => dayIndex(s.start_time) === i)
                .map((s) => {
                  const top = ((minutesOf(s.start_time) - startH * 60) / 60) * HOUR_PX;
                  const height = Math.max(26, ((minutesOf(s.end_time || s.start_time) - minutesOf(s.start_time)) / 60) * HOUR_PX - 3);
                  return (
                    <div
                      key={s.id}
                      className={`week-block t-${s.slot_type} ${s.is_cancelled ? "cancelled" : ""}`}
                      style={{ top, height, ["--c" as string]: hueOf(s.title) }}
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
                        onClick={() => onToggle(s.id, s.is_cancelled)}
                        aria-label={s.is_cancelled ? `Restore ${s.title}` : `Cancel ${s.title}`}
                        title={s.is_cancelled ? "Restore" : "Mark cancelled"}
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
      <div className="dayview">
        <div className="schedule-tabs" role="tablist">
          {DAYS.map((d, i) => (
            <button key={d} role="tab" aria-selected={day === i} className={`schedule-tab ${day === i ? "active" : ""}`} onClick={() => setDay(i)}>
              {d} <span className="muted">{dates[i].getUTCDate()}</span>
            </button>
          ))}
        </div>
        {daySlots.length === 0 ? (
          <div className="empty">Nothing scheduled on {DAYS[day]}.</div>
        ) : (
          <div className="timetable-grid">
            {daySlots.map((s) => (
              <div key={s.id} className={`slot-card ${s.slot_type} ${s.is_cancelled ? "cancelled" : ""}`} style={{ ["--c" as string]: hueOf(s.title) }}>
                <div className="slot-info">
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
                <button type="button" className="ghost" onClick={() => onToggle(s.id, s.is_cancelled)}>
                  {s.is_cancelled ? "Restore" : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
