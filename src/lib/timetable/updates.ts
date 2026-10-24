import { DATE_RANGE_RE, extractEventDetails, extractTimeFromText } from "../events.ts";
import { ALL_COURSES, holidayFromNotice } from "./holiday.ts";
import { sessionUpdates } from "./sessions.ts";

export type CourseUpdate = {
  course_code: string;
  kind: "cancelled" | "moved" | "added";
  on_date: string; // YYYY-MM-DD (IST)
  until_date?: string | null; // last day of a multi-day change (a buffer week); null = just on_date
  /** Only students in this division (D3, D4…); null = everyone taking the course. */
  division?: string | null;
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
  division?: string | null;
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

/**
 * Every timetable change a notice makes. Usually one; a forum post can say both "no more lectures"
 * and "doubt session on Friday in KR-225".
 */
export function updatesFromNotice(subject: string, rawBody: string, noticeId?: string, receivedAt: Date = new Date()): CourseUpdate[] {
  const session = sessionUpdates(subject, rawBody, noticeId, receivedAt);
  if (session.length) return session;
  const one = updateFromNotice(subject, rawBody, noticeId, receivedAt);
  return one ? [one] : [];
}

/** Turn a notice into a course-level timetable change, or null if it isn't one. */
export function updateFromNotice(
  subject: string,
  rawBody: string,
  noticeId?: string,
  receivedAt: Date = new Date()
): CourseUpdate | null {
  const body = rawBody.replace(POSTED_LINE_RE, " ");
  const session = sessionUpdates(subject, rawBody, noticeId, receivedAt);
  if (session.length) return session[0];
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
    // A quiz or exam goes on the timetable only with one clear day and a written time. "During the week of 26–30 October"
    // names no day, and a missing time would otherwise become a made-up 10:00.
    if (ev.slot_type !== "deadline" && (!hasTime || DATE_RANGE_RE.test(text))) return null;
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
/** True if the student's slots for this course are in that division (or their division isn't known). */
function inDivision(slots: Slot[], course: string, division: string): boolean {
  const mine = slots.filter((s) => courseCodeOf(s.title) === course && s.division);
  return mine.length === 0 || mine.some((s) => s.division!.toUpperCase() === division.toUpperCase());
}

export function applyCourseUpdates(slots: Slot[], updates: CourseUpdate[]): Slot[] {
  const myCourses = new Set(slots.map((s) => courseCodeOf(s.title)).filter(Boolean) as string[]);
  const out = slots.map((s) => ({ ...s }));

  for (const u of updates) {
    if (u.kind === "added") {
      if (!myCourses.has(u.course_code) || !u.new_start) continue;
      if (u.division && !inDivision(out, u.course_code, u.division)) continue;
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
        slot_type: !u.slot_type || u.slot_type === "session" ? "event" : u.slot_type,
        notice_id: u.notice_id,
        verified: u.verified,
      });
      continue;
    }

    const last = u.until_date && u.until_date > u.on_date ? u.until_date : u.on_date;
    const sameDay = out.filter((s) => {
      const d = istDate(s.start_time);
      if (!(u.course_code === ALL_COURSES || courseCodeOf(s.title) === u.course_code) || d < u.on_date || d > last) return false;
      if (s.slot_type === "quiz" || s.slot_type === "exam") return false;
      // A notice for D4 leaves D3's classes alone (slots without a known division follow the notice).
      if (u.division && s.division && s.division.toUpperCase() !== u.division.toUpperCase()) return false;
      // "No more lectures" is about lectures, not the lab or the tutorial.
      if (u.slot_type === "lecture" && (s.slot_type === "lab" || /\(Tutorial\)/.test(s.title))) return false;
      return true;
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
