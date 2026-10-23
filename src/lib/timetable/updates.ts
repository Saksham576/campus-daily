import { extractEventDetails, extractTimeFromText } from "../events.ts";
import { ALL_COURSES, holidayFromNotice } from "./holiday.ts";

export type CourseUpdate = {
  course_code: string;
  kind: "cancelled" | "moved" | "added";
  on_date: string; // YYYY-MM-DD (IST)
  until_date?: string | null; // last day of a multi-day change (a buffer week); null = just on_date
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

// Moodle/Bodhitree forum mails carry a "by Name - Thursday, 15 October 2026, 2:34 PM" posting line.
const POSTED_LINE_RE =
  /\bby\s[^\n]{0,80}?\s[-–]\s(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s+\d{1,2}\s+[a-z]+\s+\d{4},?\s+\d{1,2}:\d{2}\s*(?:am|pm)?/gi;
// Follow-ups about a past assessment, not a new event.
const AFTERMATH_RE =
  /\b(solutions?|answer\s*(?:keys?|sheets?|scripts?)|answersheets?|results?|marks|grades?|graded|uploaded|released|feedback|re-?evaluation|crib|paper viewing|viewing session)\b/i;
const ROOM_RE = /^(LA|LC|LH|LT|CC|SIC|MB)\s\d/;
// The event parser falls back to "today" when no date is written; a timetable change needs a real one.
const DATE_WORDS_RE =
  /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{4}-\d{2}-\d{2}|today|tonight|tomorrow|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i;

// "Buffer week", "no regular classes this week": every class of the course in that stretch is off.
const WEEK_OFF_RE =
  /\b(buffer\s+week|no\s+(?:regular\s+)?(?:classes|lectures)\s+(?:are\s+)?(?:scheduled\s+)?(?:this|next)\s+week|(?:classes|lectures)\s+(?:are\s+)?(?:suspended|off|not\s+(?:be\s+)?held)\s+(?:this|next)\s+week)\b/i;
const NEXT_CLASS_RE = /next\s+(?:regular\s+)?(?:class|lecture)[^0-9]{0,40}(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/i;

const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

/** A whole stretch with no classes for one course, or null. Runs from the notice day (or next Monday) to the end of the week or the day before the stated next class. */
function weekOffFromNotice(subject: string, body: string, noticeId: string | undefined, receivedAt: Date): CourseUpdate | null {
  const text = `${subject}
${body}`;
  if (!WEEK_OFF_RE.test(text) || /^\s*\[(s\.events|student-notices)\]/i.test(subject)) return null;
  const code = courseCodeOf(subject);
  if (!code || ROOM_RE.test(code)) return null;
  const today = istDate(receivedAt.toISOString());
  const dow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  const nextWeek = /next\s+week/i.test(text) && !/this\s+week/i.test(text);
  const monday = addDays(today, -dow + (nextWeek ? 7 : 0));
  const from = nextWeek ? monday : today;
  let until = addDays(monday, 6);
  const m = text.match(NEXT_CLASS_RE);
  if (m) {
    const back = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(back) && back > from) {
      const lastOff = addDays(back, -1);
      if (lastOff > until && lastOff <= addDays(from, 14)) until = lastOff;
    }
  }
  return { course_code: code, kind: "cancelled", on_date: from, until_date: until, match_start: null, notice_id: noticeId ?? null };
}

/** Turn a notice into a course-level timetable change, or null if it isn't one. */
export function updateFromNotice(
  subject: string,
  rawBody: string,
  noticeId?: string,
  receivedAt: Date = new Date()
): CourseUpdate | null {
  const body = rawBody.replace(POSTED_LINE_RE, " ");
  const weekOff = weekOffFromNotice(subject, body, noticeId, receivedAt);
  if (weekOff) return weekOff;
  const holiday = holidayFromNotice(subject, body, noticeId, receivedAt);
  if (holiday) return holiday;
  const ev = extractEventDetails(subject, body);
  if (!ev || !ev.course_code) return null;
  // Lecture halls ("LA 001", "LC 101", "LH 302"…) look like course codes but aren't; club/event lists aren't course notices.
  if (ROOM_RE.test(ev.course_code) || /^\s*\[(s\.events|student-notices)\]/i.test(subject)) return null;
  const text = `${subject}\n${body}`;
  if (!DATE_WORDS_RE.test(text)) return null;
  const hasTime = extractTimeFromText(text) !== null;
  const base = { course_code: ev.course_code, on_date: istDate(ev.start_time), notice_id: noticeId ?? null };
  const startsLater = new Date(ev.start_time).getTime() > receivedAt.getTime();

  if (ev.is_cancelled) {
    // A cancellation can be for later today, so compare calendar days.
    if (base.on_date < istDate(receivedAt.toISOString())) return null;
    return { ...base, kind: "cancelled", match_start: hasTime ? ev.start_time : null };
  }
  if (AFTERMATH_RE.test(subject) || !startsLater) return null;
  // Adding something to a timetable needs the subject itself to name it ("Reading about Kant" mentioning a quiz isn't one).
  const namesIt =
    ev.slot_type === "deadline"
      ? /\b(deadline|due|submission|submit|last date)\b/i.test(subject)
      : /\b(quiz(?:zes)?|exams?|tests?|viva|mid-?sems?|end-?sems?|re-?exam)\b/i.test(subject);
  if ((ev.slot_type === "quiz" || ev.slot_type === "exam" || ev.slot_type === "deadline") && namesIt) {
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

    const last = u.until_date && u.until_date > u.on_date ? u.until_date : u.on_date;
    const sameDay = out.filter((s) => {
      const d = istDate(s.start_time);
      return (u.course_code === ALL_COURSES || courseCodeOf(s.title) === u.course_code) && d >= u.on_date && d <= last && s.slot_type !== "quiz" && s.slot_type !== "exam";
    });
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

/**
 * A student's own saved slots (their Cancel / Restore and custom slots) replace the
 * matching computed class (same title and start time).
 */
export function withPersonalOverrides<A extends { title: string; start_time: string }>(week: A[], saved: A[]): A[] {
  const key = (x: A) => `${x.title}|${new Date(x.start_time).getTime()}`;
  const savedKeys = new Set(saved.map(key));
  return [...week.filter((w) => !savedKeys.has(key(w))), ...saved].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}
