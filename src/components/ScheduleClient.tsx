"use client";

import { useState } from "react";
import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { TimetableView } from "@/components/TimetableView";
import { Download, Pencil, Plus } from "lucide-react";
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
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function ScheduleClient({ initialSchedules, moodleOn }: { initialSchedules: ScheduleItem[]; moodleOn: boolean }) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(initialSchedules);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);

  // Form state for adding custom slot
  const [newTitle, setNewTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newDay, setNewDay] = useState(1); // 1 = Mon
  const [newStartTime, setNewStartTime] = useState("09:30");
  const [newEndTime, setNewEndTime] = useState("10:25");
  const [newSlotType, setNewSlotType] = useState<ScheduleItem["slot_type"]>("lecture");

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Calculate occurrence of chosen day in the current week
    const now = new Date();
    const currentDay = now.getDay() || 7;
    const diff = newDay - currentDay;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diff);

    const [sh, sm] = newStartTime.split(":").map(Number);
    const [eh, em] = newEndTime.split(":").map(Number);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const startIso = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(
      targetDate.getDate()
    )}T${pad(sh)}:${pad(sm)}:00+05:30`;
    const endIso = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(
      targetDate.getDate()
    )}T${pad(eh)}:${pad(em)}:00+05:30`;

    const newSlot: Partial<ScheduleItem> = {
      user_id: user.id,
      title: newTitle,
      location: newLocation || "IIT Bombay",
      start_time: new Date(startIso).toISOString(),
      end_time: new Date(endIso).toISOString(),
      slot_type: newSlotType,
      is_cancelled: false,
    };

    const { data, error } = await supabase
      .from("user_schedules")
      .insert(newSlot)
      .select()
      .single();

    if (!error && data) {
      setSchedules((prev) => [...prev, data as ScheduleItem]);
    } else {
      setSchedules((prev) => [
        ...prev,
        { ...newSlot, id: `custom-${Date.now()}` } as ScheduleItem,
      ]);
    }

    setNewTitle("");
    setNewLocation("");
    setShowAddModal(false);
    setStatusNotification("Custom slot added successfully!");
    setTimeout(() => setStatusNotification(null), 4000);
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
      <main className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">{SEMESTER.name}</p>
            <h1>Timetable</h1>
          </div>
          <div className="nav-links">
            <button type="button" onClick={() => setShowAddModal(!showAddModal)}>
              <Plus aria-hidden />
              Add slot
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
          <form onSubmit={handleAddSlot} className="panel pform" style={{ marginBottom: 20 }}>
            <div className="panel-head" style={{ marginBottom: 0 }}>
              <h2 className="panel-title">Add a slot</h2>
            </div>
            <div className="row2">
              <label>
                Title
                <input type="text" required placeholder="e.g. MA 105 extra tutorial" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </label>
              <label>
                Venue
                <input type="text" placeholder="e.g. LA 201" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} />
              </label>
            </div>
            <div className="row2">
              <label>
                Day
                <select value={newDay} onChange={(e) => setNewDay(Number(e.target.value))}>
                  {DAYS.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select value={newSlotType} onChange={(e) => setNewSlotType(e.target.value as any)}>
                  <option value="lecture">Lecture</option>
                  <option value="lab">Lab</option>
                  <option value="quiz">Quiz</option>
                  <option value="exam">Exam</option>
                  <option value="deadline">Deadline</option>
                  <option value="custom">Other</option>
                </select>
              </label>
            </div>
            <div className="row2">
              <label>
                Starts
                <input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
              </label>
              <label>
                Ends
                <input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
              </label>
            </div>
            <div className="actions">
              <button type="submit" className="primary">
                Save slot
              </button>
              <button type="button" onClick={() => setShowAddModal(false)} className="ghost">
                Cancel
              </button>
            </div>
          </form>
        )}

        {!moodleOn && schedules.length > 0 && (
          <p className="note" style={{ marginTop: 0, marginBottom: 16 }}>
            Times come from the official IITB slot chart. Moodle isn&apos;t connected, so changes your professors post there (extra classes, shifted labs) won&apos;t show.{" "}
            <Link href="/settings#moodle">Connect Moodle</Link>
          </p>
        )}
        <TimetableView slots={schedules} onToggle={handleToggleCancellation} />
      </main>
    </>
  );
}
