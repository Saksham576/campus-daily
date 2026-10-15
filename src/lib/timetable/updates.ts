import { extractEventDetails, extractTimeFromText } from "../events.ts";

export type CourseUpdate = {
  course_code: string;
  kind: "cancelled" | "moved" | "added";
  on_date: string; // YYYY-MM-DD (IST)
  match_start?: string | null;
  new_start?: string | null;
  new_end?: string | null;
  new_location?: string | null;
  slot_type?: string | null;
  title?: string | null;
  notice_id?: string | null;
  verified?: boolean;
};

export type Slot = {
  id: string;
  title: string;
  location?: string | null;
  start_time: string;
  end_time?: string | null;
  slot_type: string;
  is_cancelled?: boolean;
  notice_id?: string | null;
  verified?: boolean;
};

const IST_MS = 5.5 * 3600 * 1000;

/** Calendar date (YYYY-MM-DD) of an instant in IST. */
export function istDate(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_MS).toISOString().slice(0, 10);
}

/** "MA 105: Calculus" / "ma105 quiz" -> "MA 105" */
export function courseCodeOf(title: string): string | null {
  const m = title.match(/\b([A-Z]{2,3})\s*([0-9]{3}[A-Z]?)\b/i);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
}

const MOVE_RE = /\b(shifted|moved|rescheduled|preponed|venue\s+(?:changed|change)|changed\s+to|will\s+now\s+be|now\s+(?:at|in))\b/i;

/** Turn a notice into a course-level timetable change, or null if it isn't one. */
export function updateFromNotice(subject: string, body: string, noticeId?: string): CourseUpdate | null {
  const ev = extractEventDetails(subject, body);
  if (!ev || !ev.course_code) return null;
  const text = `${subject}\n${body}`;
  const hasTime = extractTimeFromText(text) !== null;
  const base = { course_code: ev.course_code, on_date: istDate(ev.start_time), notice_id: noticeId ?? null };

  if (ev.is_cancelled) {
    return { ...base, kind: "cancelled", match_start: hasTime ? ev.start_time : null };
  }
  if (ev.slot_type === "quiz" || ev.slot_type === "exam" || ev.slot_type === "deadline") {
    return {
      ...base,
      kind: "added",
      new_start: ev.start_time,
      new_end: ev.end_time ?? null,
      new_location: ev.location ?? null,
      slot_type: ev.slot_type,
      title: ev.title,
    };
  }
  if (MOVE_RE.test(text) && (ev.location || hasTime)) {
    return {
      ...base,
      kind: "moved",
      new_location: ev.location ?? null,
      new_start: hasTime ? ev.start_time : null,
      new_end: hasTime ? ev.end_time ?? null : null,
    };
  }
  return null;
}

/**
 * Apply course updates to a student's slots. Cancels/moves matching slots
 * (same course, same IST day; same start time too if the update names one)
 * and adds quizzes/exams for courses the student takes.
 */
export function applyCourseUpdates(slots: Slot[], updates: CourseUpdate[]): Slot[] {
  const myCourses = new Set(slots.map((s) => courseCodeOf(s.title)).filter(Boolean) as string[]);
  const out = slots.map((s) => ({ ...s }));

  for (const u of updates) {
    if (u.kind === "added") {
      if (!myCourses.has(u.course_code) || !u.new_start) continue;
      const dup = out.some(
        (s) => courseCodeOf(s.title) === u.course_code && s.start_time === u.new_start && s.slot_type === (u.slot_type || "event")
      );
      if (dup) continue;
      out.push({
        id: `update-${u.notice_id ?? u.course_code + u.new_start}`,
        title: u.title || `${u.course_code} ${(u.slot_type || "event").toUpperCase()}`,
        location: u.new_location,
        start_time: u.new_start,
        end_time: u.new_end,
        slot_type: u.slot_type || "event",
        notice_id: u.notice_id,
        verified: u.verified,
      });
      continue;
    }

    const sameDay = out.filter(
      (s) => courseCodeOf(s.title) === u.course_code && istDate(s.start_time) === u.on_date && s.slot_type !== "quiz" && s.slot_type !== "exam"
    );
    const exact = u.match_start ? sameDay.filter((s) => s.start_time === u.match_start) : [];
    const targets = exact.length > 0 ? exact : sameDay;

    for (const s of targets) {
      if (u.kind === "cancelled") s.is_cancelled = true;
      if (u.kind === "moved") {
        if (u.new_location) s.location = u.new_location;
        if (u.new_start) {
          const dur = s.end_time ? new Date(s.end_time).getTime() - new Date(s.start_time).getTime() : 3600000;
          s.start_time = u.new_start;
          s.end_time = u.new_end ?? new Date(new Date(u.new_start).getTime() + dur).toISOString();
        }
      }
      s.notice_id = u.notice_id ?? s.notice_id;
      s.verified = u.verified || s.verified;
    }
  }
  return out;
}
