"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateMultiEventIcs } from "@/lib/events";
import { buildWeek, type UserCourse } from "@/lib/timetable/slots";
import { applyCourseUpdates, istDate, type CourseUpdate } from "@/lib/timetable/updates";

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

/**
 * Weekly classes from the student's courses + the student's saved slots, with course-level
 * updates (cancellations, venue/time changes, quizzes) from notices applied.
 */
async function loadMergedSchedule(
  userId: string,
  division?: string | null,
  hasmed?: string | null
): Promise<ScheduleItem[]> {
  const supabase = createClient();
  const { data: dbSchedules } = await supabase
    .from("user_schedules")
    .select("*")
    .order("start_time", { ascending: true });
  const saved = (dbSchedules || []) as ScheduleItem[];

  // Weekly classes from the student's real courses (Settings → My courses) + the IITB slot chart.
  const { data: courses } = await supabase
    .from("user_courses")
    .select("course_code, title, division, lecture_slots, tutorial_slots, venue");
  const baseline = buildWeek((courses || []) as UserCourse[]).map((s) => ({
    ...s,
    user_id: userId,
    is_cancelled: false,
  })) as ScheduleItem[];
  const savedKeys = new Set(saved.map((s) => `${s.title}|${new Date(s.start_time).getTime()}`));
  const merged = [
    ...baseline.filter((b) => !savedKeys.has(`${b.title}|${new Date(b.start_time).getTime()}`)),
    ...saved,
  ];

  // This week's course updates (Mon–Sun, IST dates)
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const { data: updates } = await supabase
    .from("course_updates")
    .select("*")
    .gte("on_date", istDate(monday.toISOString()))
    .lte("on_date", istDate(sunday.toISOString()))
    .order("created_at", { ascending: true });

  return (applyCourseUpdates(merged, (updates || []) as CourseUpdate[]) as ScheduleItem[]).sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = Mon, 4 = Fri
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [userDivision, setUserDivision] = useState<string>("D1");
  const [userHasmed, setUserHasmed] = useState<string | null>(null);
  const [hasMoodleUrl, setHasMoodleUrl] = useState<boolean>(false);
  const [syncingMoodle, setSyncingMoodle] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);

  // Form state for adding custom slot
  const [newTitle, setNewTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newDay, setNewDay] = useState(1); // 1 = Mon
  const [newStartTime, setNewStartTime] = useState("09:30");
  const [newEndTime, setNewEndTime] = useState("10:25");
  const [newSlotType, setNewSlotType] = useState<ScheduleItem["slot_type"]>("lecture");

  useEffect(() => {
    async function loadSchedule() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch user profile metadata (division, HASMED elective, Moodle URL)
      const { data: sub } = await supabase
        .from("subscribers")
        .select("division, hasmed, moodle_ical_url")
        .eq("email", user.email)
        .single();

      if (sub?.division) {
        setUserDivision(sub.division);
      }
      if (sub?.hasmed) {
        setUserHasmed(sub.hasmed);
      }
      if (sub?.moodle_ical_url) {
        setHasMoodleUrl(true);
      }

      setSchedules(await loadMergedSchedule(user.id, sub?.division, sub?.hasmed));
      setLoading(false);
    }
    loadSchedule();
  }, [router]);

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

    setSchedules((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, is_cancelled: nextStatus } : s))
    );

    if (!slotId.startsWith("course-") && !slotId.startsWith("custom-") && !slotId.startsWith("update-")) {
      await supabase
        .from("user_schedules")
        .update({ is_cancelled: nextStatus })
        .eq("id", slotId);
    }
  }

  async function handleSyncMoodle() {
    setSyncingMoodle(true);
    setStatusNotification("Syncing assignments and quizzes from Moodle…");

    try {
      const res = await fetch("/api/sync/moodle", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setStatusNotification(`Sync error: ${data.error || "Failed to reach Moodle"}`);
      } else {
        setStatusNotification(data.message || `Synced ${data.synced} events from Moodle!`);
        // Refresh schedules from DB
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) setSchedules(await loadMergedSchedule(user.id, userDivision, userHasmed));
      }
    } catch (err: any) {
      setStatusNotification(`Sync error: ${err.message}`);
    } finally {
      setSyncingMoodle(false);
      setTimeout(() => setStatusNotification(null), 5000);
    }
  }

  function handleExportWeekIcs() {
    if (schedules.length === 0) {
      alert("No slots to export.");
      return;
    }

    // Weekly classes repeat weekly throughout the semester
    const fullIcs = generateMultiEventIcs(
      schedules.map((s) => ({
        title: `${s.is_cancelled ? "[CANCELLED] " : ""}${s.title}`,
        description: `Campus Daily IIT Bombay (${s.slot_type})`,
        location: s.location || "IIT Bombay",
        start_time: s.start_time,
        end_time: s.end_time || undefined,
        rrule: s.slot_type === "lecture" || s.slot_type === "lab" ? "FREQ=WEEKLY;UNTIL=20261205T183000Z" : undefined,
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

  // Filter slots for the selected day (0 = Mon .. 4 = Fri)
  const currentDaySlots = schedules.filter((s) => {
    try {
      const d = new Date(s.start_time);
      const dayIndex = d.getDay(); // 0 is Sun, 1 is Mon, 5 is Fri
      const mondayZeroIndexed = dayIndex === 0 ? 6 : dayIndex - 1;
      return mondayZeroIndexed === selectedDay;
    } catch {
      return false;
    }
  });

  if (loading) {
    return (
      <main className="wrap narrow">
        <p className="muted">Loading your timetable…</p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">Academic Timetable</p>
          <h1>Your Schedule</h1>
          <p className="muted">
            Built from your courses (slots as on ResoBin) · Auto-updated from notices ·{" "}
            <Link href="/settings#courses">Edit my courses</Link>
          </p>
          {!loading && schedules.length === 0 && (
            <p className="note">
              No classes yet. Add your courses in{" "}
              <Link href="/settings#courses">Settings → My courses</Link> and your week will appear here.
            </p>
          )}
        </div>
        <div className="nav-links">
          <Link href="/" className="navlink">Feed</Link>
          <Link href="/settings" className="navlink">Settings</Link>
        </div>
      </header>

      {statusNotification && (
        <p className="note" style={{ borderColor: "var(--accent)", marginBottom: 16 }}>
          {statusNotification}
        </p>
      )}

      {/* Weekday Selector Tabs */}
      <div className="schedule-tabs">
        {DAYS.map((dayName, idx) => (
          <button
            key={dayName}
            onClick={() => setSelectedDay(idx)}
            className={`schedule-tab ${selectedDay === idx ? "active" : ""}`}
          >
            {dayName}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontSize: 18, fontFamily: "Georgia, serif" }}>
          {DAYS[selectedDay]} Classes & Deadlines
        </h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={handleSyncMoodle}
            disabled={syncingMoodle}
            className="small"
            title="Pull quiz and assignment deadlines from your Moodle iCal URL"
          >
            {syncingMoodle ? "Syncing…" : "🔄 Sync Moodle"}
          </button>
          <button
            onClick={() => setShowAddModal(!showAddModal)}
            className="small"
          >
            + Add Slot
          </button>
          <button
            onClick={handleExportWeekIcs}
            className="small accent"
            title="Download full semester recurring .ics calendar file"
          >
            📥 Export All (.ics)
          </button>
        </div>
      </div>

      {/* Quick Add Slot Modal / Inline Form */}
      {showAddModal && (
        <form onSubmit={handleAddSlot} className="note pform" style={{ marginTop: 0, marginBottom: 20 }}>
          <h4 style={{ fontWeight: 600 }}>Add Custom Slot / Study Block</h4>
          <div className="row2">
            <label>
              Title / Course Code
              <input
                type="text"
                required
                placeholder="e.g. MA 105 Extra Tutorial"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </label>
            <label>
              Location / Venue
              <input
                type="text"
                placeholder="e.g. LA 201 or Online"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
              />
            </label>
          </div>
          <div className="row2">
            <label>
              Day
              <select
                value={newDay}
                onChange={(e) => setNewDay(Number(e.target.value))}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i + 1}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Slot Type
              <select
                value={newSlotType}
                onChange={(e) => setNewSlotType(e.target.value as any)}
              >
                <option value="lecture">Lecture</option>
                <option value="lab">Lab</option>
                <option value="quiz">Quiz</option>
                <option value="exam">Exam</option>
                <option value="deadline">Deadline</option>
                <option value="custom">Custom</option>
              </select>
            </label>
          </div>
          <div className="row2">
            <label>
              Start Time
              <input
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
              />
            </label>
            <label>
              End Time
              <input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="submit" className="primary" style={{ padding: "8px 16px" }}>Save Slot</button>
            <button type="button" onClick={() => setShowAddModal(false)} className="link">Cancel</button>
          </div>
        </form>
      )}

      {/* Slots List */}
      {currentDaySlots.length === 0 ? (
        <div className="note" style={{ textAlign: "center", padding: 30 }}>
          <p className="muted">No classes or deadlines scheduled for {DAYS[selectedDay]}. Enjoy your free slot!</p>
        </div>
      ) : (
        <div className="timetable-grid">
          {currentDaySlots.map((slot) => {
            const startD = new Date(slot.start_time);
            const endD = slot.end_time ? new Date(slot.end_time) : null;
            const timeStr = `${startD.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            })}${endD ? ` – ${endD.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}` : ""}`;

            return (
              <div
                key={slot.id}
                className={`slot-card ${slot.slot_type} ${slot.is_cancelled ? "cancelled" : ""}`}
              >
                <div className="slot-info">
                  <h4>{slot.title}</h4>
                  <div className="slot-time">
                    <span className={`slot-pill ${slot.is_cancelled ? "cancelled" : slot.slot_type}`}>
                      {slot.is_cancelled ? "Cancelled" : slot.slot_type}
                    </span>
                    <span>⏰ {timeStr}</span>
                    {slot.location && <span>· 📍 {slot.location}</span>}
                  </div>
                </div>

                <div className="actions" style={{ marginTop: 0 }}>
                  <button
                    onClick={() => handleToggleCancellation(slot.id, slot.is_cancelled)}
                    className="link small"
                    style={{ color: slot.is_cancelled ? "var(--green)" : "var(--accent)" }}
                    title={slot.is_cancelled ? "Mark as active" : "Mark as cancelled"}
                  >
                    {slot.is_cancelled ? "Restore" : "Cancel Class"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
