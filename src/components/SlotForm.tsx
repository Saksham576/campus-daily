"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDays } from "@/lib/timetable/range";
import { SEMESTER } from "@/lib/timetable/semester";
import { weeklyDates } from "@/lib/timetable/ics";
import { istDate } from "@/lib/timetable/updates";
import type { ScheduleItem } from "@/components/ScheduleClient";

const DAY_CHIPS = [
  { d: 1, label: "Mon" },
  { d: 2, label: "Tue" },
  { d: 3, label: "Wed" },
  { d: 4, label: "Thu" },
  { d: 5, label: "Fri" },
  { d: 6, label: "Sat" },
  { d: 0, label: "Sun" },
];
const TYPES: { v: ScheduleItem["slot_type"]; label: string }[] = [
  { v: "lecture", label: "Class" },
  { v: "lab", label: "Lab" },
  { v: "quiz", label: "Quiz" },
  { v: "exam", label: "Exam" },
  { v: "event", label: "Event" },
  { v: "custom", label: "Other" },
];

/** Add your own slot: once on any date (weekends too), or every week on the days you pick until a date. */
export function SlotForm({ onSaved, onClose }: { onSaved: (rows: ScheduleItem[], note: string) => void; onClose: () => void }) {
  const today = istDate(new Date().toISOString());
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [type, setType] = useState<ScheduleItem["slot_type"]>("lecture");
  const [repeat, setRepeat] = useState<"once" | "weekly">("once");
  const [date, setDate] = useState(today);
  const [days, setDays] = useState<number[]>([]);
  const [until, setUntil] = useState<string>(SEMESTER.endSemEnd);
  const [start, setStart] = useState("09:30");
  const [end, setEnd] = useState("10:25");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleDay = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Give the slot a name.");
    if (end <= start) return setError("The end time must be after the start time.");
    let dates: string[];
    if (repeat === "once") dates = [date];
    else {
      if (!days.length) return setError("Pick at least one day.");
      if (until < today) return setError("The last date must be today or later.");
      if (until > addDays(today, 200)) return setError("Repeats can run up to about six months.");
      dates = weeklyDates(today, until, days);
      if (!dates.length) return setError("No matching days before that date.");
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const series = repeat === "weekly" ? crypto.randomUUID() : null;
      const rows = dates.map((d) => ({
        user_id: user.id,
        title: title.trim().slice(0, 200),
        location: venue.trim() || null,
        start_time: new Date(`${d}T${start}:00+05:30`).toISOString(),
        end_time: new Date(`${d}T${end}:00+05:30`).toISOString(),
        slot_type: type,
        is_cancelled: false,
        origin: "manual",
        series_id: series,
      }));
      const { data, error: err } = await supabase.from("user_schedules").insert(rows).select();
      if (err) throw new Error(err.message);
      onSaved((data || []) as ScheduleItem[], rows.length === 1 ? "Slot added." : `Added ${rows.length} slots.`);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Couldn't save that slot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel pform" style={{ marginBottom: 20 }}>
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <h2 className="panel-title">Add a slot</h2>
      </div>
      <div className="row2">
        <label>
          Name
          <input type="text" required placeholder="e.g. Football practice, extra tutorial" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </label>
        <label>
          Venue
          <input type="text" placeholder="e.g. LA 201, Gym" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} />
        </label>
      </div>
      <div className="field">
        <span>Kind</span>
        <div className="chips" role="radiogroup" aria-label="Kind of slot">
          {TYPES.map((t) => (
            <button key={t.v} type="button" role="radio" aria-checked={type === t.v} className={`chip ${type === t.v ? "on" : ""}`} onClick={() => setType(t.v)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>How often</span>
        <div className="seg" role="radiogroup" aria-label="How often">
          <button type="button" role="radio" aria-checked={repeat === "once"} className={repeat === "once" ? "on" : ""} onClick={() => setRepeat("once")}>
            Just once
          </button>
          <button type="button" role="radio" aria-checked={repeat === "weekly"} className={repeat === "weekly" ? "on" : ""} onClick={() => setRepeat("weekly")}>
            Every week
          </button>
        </div>
      </div>
      {repeat === "once" ? (
        <label>
          Date
          <input type="date" value={date} min={addDays(today, -30)} onChange={(e) => setDate(e.target.value)} required />
        </label>
      ) : (
        <>
          <div className="field">
            <span>On these days</span>
            <div className="chips" role="group" aria-label="Days of the week">
              {DAY_CHIPS.map((c) => (
                <button key={c.d} type="button" aria-pressed={days.includes(c.d)} className={`chip ${days.includes(c.d) ? "on" : ""}`} onClick={() => toggleDay(c.d)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <label>
            Until
            <input type="date" value={until} min={today} onChange={(e) => setUntil(e.target.value)} required />
            <span className="help">Starts today. Default is the last day of end-semester exams.</span>
          </label>
        </>
      )}
      <div className="row2">
        <label>
          Starts
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label>
          Ends
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </label>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Saving…" : repeat === "weekly" ? "Save weekly slot" : "Save slot"}
        </button>
        <button type="button" onClick={onClose} className="ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
