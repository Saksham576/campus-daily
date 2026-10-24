"use client";

import { useState } from "react";
import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { TimetableView } from "@/components/TimetableView";
import { CalendarPlus, Download, Pencil, Plus } from "lucide-react";
import { SlotForm } from "@/components/SlotForm";
import { CalendarImport, type Feed } from "@/components/CalendarImport";
import { createClient } from "@/lib/supabase/client";
import { generateMultiEventIcs } from "@/lib/events";
import { SEMESTER, addDays, mondayOf } from "@/lib/timetable/range";
import { istDate } from "@/lib/timetable/updates";

export type ScheduleItem = {
  id: string;
  user_id: string;
  notice_id?: string | null;
  title: string;
  location?: string | null;
  start_time: string;
  end_time?: string | null;
  slot_type: "lecture" | "lab" | "quiz" | "exam" | "deadline" | "event" | "custom";
  is_cancelled?: boolean;
  series_id?: string | null;
  origin?: "manual" | "gcal" | null;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function ScheduleClient({ initialSchedules, moodleOn, feed }: { initialSchedules: ScheduleItem[]; moodleOn: boolean; feed: Feed }) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(initialSchedules);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const note = (text: string) => {
    setStatusNotification(text);
    setTimeout(() => setStatusNotification(null), 5000);
  };

  /** Delete your own slot: just this one, or every repeat of it. */
  async function removeSlot(slot: ScheduleItem, scope: "one" | "series") {
    const supabase = createClient();
    const q = supabase.from("user_schedules").delete();
    const { error } = scope === "series" && slot.series_id ? await q.eq("series_id", slot.series_id) : await q.eq("id", slot.id);
    if (error) return note("Could not delete that. Please try again.");
    setSchedules((prev) => prev.filter((x) => (scope === "series" && slot.series_id ? x.series_id !== slot.series_id : x.id !== slot.id)));
    note(scope === "series" ? "Deleted every repeat." : "Deleted.");
  }

  /** Change the name, venue or times of your own slot (this one, or every repeat in its series). */
  async function editSlot(slot: ScheduleItem, patch: { title: string; location: string; start: string; end: string }, scope: "one" | "series") {
    const supabase = createClient();
    const targets = scope === "series" && slot.series_id ? schedules.filter((x) => x.series_id === slot.series_id) : [slot];
    const withTime = (iso: string, hhmm: string) => new Date(`${istDate(iso)}T${hhmm}:00+05:30`).toISOString();
    const updated: ScheduleItem[] = [];
    for (const t of targets) {
      const row = { title: patch.title.trim() || t.title, location: patch.location.trim() || null, start_time: withTime(t.start_time, patch.start), end_time: withTime(t.start_time, patch.end) };
      const { error } = await supabase.from("user_schedules").update(row).eq("id", t.id);
      if (error) return note("Could not save that change. Please try again.");
      updated.push({ ...t, ...row });
    }
    setSchedules((prev) => prev.map((x) => updated.find((u) => u.id === x.id) || x));
    note(targets.length > 1 ? `Updated ${targets.length} slots.` : "Saved.");
  }

  async function handleToggleCancellation(slotId: string, currentStatus?: boolean) {
    const supabase = createClient();
    const nextStatus = !currentStatus;
    const slot = schedules.find((s) => s.id === slotId);
    if (!slot) return;
    setSchedules((prev) => prev.map((s) => (s.id === slotId ? { ...s, is_cancelled: nextStatus } : s)));

    if (slotId.startsWith("course-") || slotId.startsWith("update-") || slotId.startsWith("custom-")) {
      // A class from your courses: save your own override so it survives reloads.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("user_schedules")
        .insert({
          user_id: user.id,
          title: slot.title,
          location: slot.location || null,
          start_time: slot.start_time,
          end_time: slot.end_time || slot.start_time,
          slot_type: ["lecture", "lab", "quiz", "exam", "deadline", "event", "custom"].includes(slot.slot_type) ? slot.slot_type : "lecture",
          is_cancelled: nextStatus,
        })
        .select()
        .single();
      if (error) {
        setStatusNotification("Could not save that change. Please try again.");
        setSchedules((prev) => prev.map((s) => (s.id === slotId ? { ...s, is_cancelled: currentStatus } : s)));
        return;
      }
      setSchedules((prev) => prev.map((s) => (s.id === slotId ? (data as ScheduleItem) : s)));
    } else {
      const { error } = await supabase.from("user_schedules").update({ is_cancelled: nextStatus }).eq("id", slotId);
      if (error) {
        setStatusNotification("Could not save that change. Please try again.");
        setSchedules((prev) => prev.map((s) => (s.id === slotId ? { ...s, is_cancelled: currentStatus } : s)));
      }
    }
  }

  function handleExportWeekIcs() {
    const monday = mondayOf(new Date());
    const weekSlots = schedules.filter((s) => {
      const d = istDate(s.start_time);
      return d >= monday && d <= addDays(monday, 6);
    });
    if (weekSlots.length === 0) {
      alert("No slots to export.");
      return;
    }

    // Weekly classes repeat weekly throughout the semester
    const fullIcs = generateMultiEventIcs(
      weekSlots.map((s) => ({
        title: `${s.is_cancelled ? "[CANCELLED] " : ""}${s.title}`,
        description: `Campus Daily IIT Bombay (${s.slot_type})`,
        location: s.location || "IIT Bombay",
        start_time: s.start_time,
        end_time: s.end_time || undefined,
        rrule: s.slot_type === "lecture" || s.slot_type === "lab" ? `FREQ=WEEKLY;UNTIL=${SEMESTER.lecturesEnd.replace(/-/g, "")}T183000Z` : undefined,
      }))
    );

    const blob = new Blob([fullIcs], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `campus-daily-timetable.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <AppBar />
      <main id="main" className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">{SEMESTER.name}</p>
            <h1>Timetable</h1>
          </div>
          <div className="nav-links">
            <button type="button" onClick={() => { setShowAddModal(!showAddModal); setShowImport(false); }}>
              <Plus aria-hidden />
              Add slot
            </button>
            <button type="button" onClick={() => { setShowImport(!showImport); setShowAddModal(false); }}>
              <CalendarPlus aria-hidden />
              Import
            </button>
            <button type="button" onClick={handleExportWeekIcs} title="Download a calendar file for Google / Apple / Outlook">
              <Download aria-hidden />
              Export
            </button>
            <Link href="/settings#courses" className="navlink">
              <Pencil aria-hidden width={14} height={14} />
              Courses
            </Link>
          </div>
        </div>

        {schedules.length === 0 && (
          <div className="empty" style={{ marginBottom: 16 }}>
            No classes yet. Add your courses in <Link href="/settings#courses">Settings → My courses</Link> and your week appears here.
          </div>
        )}

        {statusNotification && <p className="note" style={{ marginTop: 0, marginBottom: 16 }}>{statusNotification}</p>}

        {showAddModal && (
          <SlotForm
            onClose={() => setShowAddModal(false)}
            onSaved={(rows, text) => {
              setSchedules((prev) => [...prev, ...rows]);
              setShowAddModal(false);
              note(text);
            }}
          />
        )}

        {showImport && <CalendarImport feed={feed} onClose={() => setShowImport(false)} onDone={note} />}

        {!moodleOn && schedules.length > 0 && (
          <p className="note" style={{ marginTop: 0, marginBottom: 16 }}>
            Times come from the official IITB slot chart. Moodle isn&apos;t connected, so changes your professors post there (extra classes, shifted labs) won&apos;t show.{" "}
            <Link href="/settings#moodle">Connect Moodle</Link>
          </p>
        )}
        <TimetableView slots={schedules} onToggle={handleToggleCancellation} onRemove={(s, scope) => removeSlot(s as ScheduleItem, scope)} onEdit={(s, patch, scope) => editSlot(s as ScheduleItem, patch, scope)} />
      </main>
    </>
  );
}
