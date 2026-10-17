"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { TimetableView } from "@/components/TimetableView";
import { Download, Pencil, Plus } from "lucide-react";
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
  // On weekends, show the coming week.
  const ref = new Date();
  if (ref.getDay() === 6 || ref.getDay() === 0) ref.setDate(ref.getDate() + (ref.getDay() === 6 ? 2 : 1));
  const baseline = buildWeek((courses || []) as UserCourse[], ref).map((s) => ({
    ...s,
    user_id: userId,
    is_cancelled: false,
  })) as ScheduleItem[];
  // This week's course updates (Mon–Sun, IST dates), applied to the course classes first…
  const monday = new Date(ref);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const { data: updates } = await supabase
    .from("course_updates")
    .select("*")
    .gte("on_date", istDate(monday.toISOString()))
    .lte("on_date", istDate(sunday.toISOString()))
    .order("created_at", { ascending: true });
  const week = applyCourseUpdates(baseline, (updates || []) as CourseUpdate[]) as ScheduleItem[];

  // …then the student's own saved slots win (their own Cancel / Restore and custom slots).
  const key = (x: ScheduleItem) => `${x.title}|${new Date(x.start_time).getTime()}`;
  const savedKeys = new Set(saved.map(key));
  return [...week.filter((w) => !savedKeys.has(key(w))), ...saved].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [userDivision, setUserDivision] = useState<string>("D1");
  const [userHasmed, setUserHasmed] = useState<string | null>(null);
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

      // Fetch user profile metadata (division, HASMED elective)
      const { data: sub } = await supabase
        .from("subscribers")
        .select("division, hasmed")
        .eq("email", user.email)
        .single();

      if (sub?.division) {
        setUserDivision(sub.division);
      }
      if (sub?.hasmed) {
        setUserHasmed(sub.hasmed);
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

  if (loading) {
    return (
      <>
        <AppBar />
        <main className="wrap">
          <p className="muted">Loading your timetable…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppBar />
      <main className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">{[0, 6].includes(new Date().getDay()) ? "Coming week" : "This week"} · updates itself from notices</p>
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

        <TimetableView slots={schedules} onToggle={handleToggleCancellation} />
      </main>
    </>
  );
}
