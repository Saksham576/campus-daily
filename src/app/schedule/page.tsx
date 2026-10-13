"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateIcs } from "@/lib/events";
import { DIVISION_SLOTS, type TimetableSlot } from "@/lib/timetable/first_year_slots";

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

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = Mon, 4 = Fri
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [userDivision, setUserDivision] = useState<string>("D1");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isPending, startTransition] = useTransition();

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

      // Fetch user division
      const { data: sub } = await supabase
        .from("subscribers")
        .select("division")
        .eq("email", user.email)
        .single();

      if (sub?.division) {
        setUserDivision(sub.division);
      }

      // Fetch saved user schedules
      const { data: dbSchedules, error } = await supabase
        .from("user_schedules")
        .select("*")
        .order("start_time", { ascending: true });

      if (dbSchedules) {
        setSchedules(dbSchedules as ScheduleItem[]);
      }

      // If user has zero custom schedules, auto-populate baseline division slots
      if ((!dbSchedules || dbSchedules.length === 0) && sub?.division) {
        const divSlots = DIVISION_SLOTS[sub.division] || DIVISION_SLOTS.D1;
        const baseline = divSlots.map((s, idx) => {
          const now = new Date();
          const dayDiff = s.day_of_week - (now.getDay() || 7);
          const d = new Date(now);
          d.setDate(now.getDate() + dayDiff);
          const [sh, sm] = s.start_time.split(":").map(Number);
          const [eh, em] = s.end_time.split(":").map(Number);
          const start = new Date(d);
          start.setHours(sh, sm, 0, 0);
          const end = new Date(d);
          end.setHours(eh, em, 0, 0);

          return {
            id: `baseline-${idx}`,
            user_id: user.id,
            title: `${s.course_code}: ${s.title}`,
            location: s.location,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            slot_type: s.slot_type,
            is_cancelled: false,
          } as ScheduleItem;
        });
        setSchedules(baseline);
      }

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

    // Calculate next occurrence of chosen day
    const now = new Date();
    const currentDay = now.getDay() || 7;
    const diff = newDay - currentDay;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diff);

    const [sh, sm] = newStartTime.split(":").map(Number);
    const [eh, em] = newEndTime.split(":").map(Number);

    const start = new Date(targetDate);
    start.setHours(sh, sm, 0, 0);

    const end = new Date(targetDate);
    end.setHours(eh, em, 0, 0);

    const newSlot: Partial<ScheduleItem> = {
      user_id: user.id,
      title: newTitle,
      location: newLocation || "IIT Bombay",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
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
      // Optimistic addition
      setSchedules((prev) => [
        ...prev,
        { ...newSlot, id: `custom-${Date.now()}` } as ScheduleItem,
      ]);
    }

    setNewTitle("");
    setNewLocation("");
    setShowAddModal(false);
  }

  async function handleToggleCancellation(slotId: string, currentStatus?: boolean) {
    const supabase = createClient();
    const nextStatus = !currentStatus;

    setSchedules((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, is_cancelled: nextStatus } : s))
    );

    if (!slotId.startsWith("baseline-") && !slotId.startsWith("custom-")) {
      await supabase
        .from("user_schedules")
        .update({ is_cancelled: nextStatus })
        .eq("id", slotId);
    }
  }

  function handleExportWeekIcs() {
    if (schedules.length === 0) {
      alert("No slots to export.");
      return;
    }

    // Combine all events into one multi-event .ics file
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const formatIcsDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
        d.getUTCDate()
      )}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(
        d.getUTCSeconds()
      )}Z`;
    };

    const dtStamp = formatIcsDate(new Date().toISOString());

    const eventsIcs = schedules
      .map((s, idx) => {
        const uid = `schedule-${s.id || idx}@campusdaily.iitb`;
        const dtStart = formatIcsDate(s.start_time);
        const dtEnd = s.end_time
          ? formatIcsDate(s.end_time)
          : formatIcsDate(
              new Date(new Date(s.start_time).getTime() + 3600000).toISOString()
            );

        return [
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${s.is_cancelled ? "[CANCELLED] " : ""}${s.title.replace(/[,;]/g, " ")}`,
          s.location ? `LOCATION:${s.location.replace(/[,;]/g, " ")}` : "",
          `DESCRIPTION:Campus Daily Schedule Slot (${s.slot_type})`,
          "STATUS:CONFIRMED",
          "END:VEVENT",
        ].join("\r\n");
      })
      .join("\r\n");

    const fullIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Campus Daily//IIT Bombay Timetable//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      eventsIcs,
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([fullIcs], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `campus-daily-week-timetable.ics`);
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
          <p className="muted">Division: <b>{userDivision}</b> · Auto-updated from notices</p>
        </div>
        <div className="nav-links">
          <Link href="/" className="navlink">Feed</Link>
          <Link href="/settings" className="navlink">Settings</Link>
        </div>
      </header>

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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontFamily: "Georgia, serif" }}>
          {DAYS[selectedDay]} Classes & Deadlines
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowAddModal(!showAddModal)}
            className="small"
          >
            + Add Slot
          </button>
          <button
            onClick={handleExportWeekIcs}
            className="small accent"
            title="Download complete week as .ics calendar file"
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
