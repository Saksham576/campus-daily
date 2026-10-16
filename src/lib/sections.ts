import { extractEventDetails, POSTED_LINE_RE } from "./events.ts";
import { formatCourseCode } from "./timetable/slots.ts";

export type SectionKey = "action" | "exams" | "courses" | "events" | "opportunities" | "campus" | "saved" | "all";

export const SECTIONS: { key: SectionKey; code: string; label: string }[] = [
  { key: "action", code: "ACT", label: "Action needed" },
  { key: "exams", code: "EXM", label: "Exams & quizzes" },
  { key: "courses", code: "CRS", label: "My courses" },
  { key: "events", code: "EVT", label: "Events" },
  { key: "opportunities", code: "OPP", label: "Opportunities" },
  { key: "campus", code: "CMP", label: "Campus life" },
  { key: "saved", code: "SVD", label: "Saved" },
  { key: "all", code: "ALL", label: "Everything" },
];

export type SectionItem = {
  id: string;
  subject: string;
  summary?: string | null;
  body?: string | null;
  tags?: unknown;
  received_at?: string | null;
  deadline_at?: string | null;
  source?: string | null;
  score?: number | null;
  status?: string | null;
  is_verified?: boolean | null;
};

export type Placed<T> = T & {
  section: Exclude<SectionKey, "saved" | "all">;
  /** When it matters: deadline for actions, start time for events. */
  when: string | null;
  /** Course codes mentioned that the student takes. */
  myCourse: string | null;
};

const ACTION_RE =
  /\b(deadline|last date|due (on|by|date)|apply|application|register|registration|submit|submission|form|fill|fee|pay|nominations?|rsvp|sign ?up|enrol|choose|preference)\b/i;
const OPPORTUNITY_RE = /\b(internship|placement|job|hiring|recruit|competition|hackathon|challenge|fellowship|scholarship|grant|olympiad|case comp)\b/i;
const EVENT_RE = /\b(workshop|talk|seminar|lecture series|session|orientation|fest|night|screening|meet|webinar|colloquium|competition|match|tournament|concert|show)\b/i;
const CAMPUS_RE = /\b(hostel|mess|h\d{1,2}\b|gymkhana|council|lost|found|sports|ground|water|electricity|maintenance|wifi|internet|bus|shuttle)\b/i;

const EXAM_RE = /\b(quiz(?:zes)?|exams?|mid-?sems?|end-?sems?|tests?|viva|re-?exam|make-?up quiz)\b/i;
// Follow-ups about a past assessment belong with the course, not in upcoming exams.
const EXAM_AFTERMATH_RE =
  /\b(solutions?|answer\s*(?:keys?|sheets?|scripts?|books?)|answersheets?|results?|marks|grades?|graded|uploaded|released|feedback|re-?evaluation|crib|syllabus|papers?|are over|is over|celebrat\w*|night|party)\b/i;

const COURSE_RE = /\b([A-Z]{2,3})\s?-?(\d{3}[A-Z]?)\b/g;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/**
 * First "by / before / till / deadline / last date … <date>" in the text (or the first date at all),
 * as an IST timestamp. No time given → 23:59. Used for deadlines, which rarely name a venue.
 */
export function parseDueDate(text: string, now = new Date()): string | null {
  const dm = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s*(\\d{4}))?`, "i");
  const md = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, "i");
  const cue = text.search(/\b(by|before|till|until|deadline|last date|due|closes?|ends?)\b/i);
  const scope = cue >= 0 ? text.slice(cue) : text;
  let day: number, month: number, year: number | null;
  const a = scope.match(dm) || text.match(dm);
  const b = scope.match(md) || text.match(md);
  if (a) {
    day = +a[1];
    month = MONTHS.findIndex((m) => a[2].toLowerCase().startsWith(m));
    year = a[3] ? +a[3] : null;
  } else if (b) {
    day = +b[2];
    month = MONTHS.findIndex((m) => b[1].toLowerCase().startsWith(m));
    year = b[3] ? +b[3] : null;
  } else return null;
  if (month < 0 || day < 1 || day > 31) return null;

  const istNow = new Date(now.getTime() + 5.5 * 3600_000);
  if (year === null) {
    year = istNow.getUTCFullYear();
    // "5 Jan" seen in December means next year
    if (Date.UTC(year, month, day) < Date.UTC(year, istNow.getUTCMonth(), istNow.getUTCDate()) - 60 * 86400_000) year++;
  }
  const real = new Date(Date.UTC(year, month, day));
  if (real.getUTCMonth() !== month) return null;

  const tm = scope.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i);
  let hh = 23,
    mm = 59;
  if (tm) {
    hh = (+tm[1] % 12) + (tm[3].toLowerCase() === "pm" ? 12 : 0);
    mm = tm[2] ? +tm[2] : 0;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(`${year}-${pad(month + 1)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00+05:30`).toISOString();
}

function myCourseIn(text: string, myCourses: Set<string>): string | null {
  for (const m of text.matchAll(COURSE_RE)) {
    const code = formatCourseCode(`${m[1]}${m[2]}`);
    if (myCourses.has(code)) return code;
  }
  return null;
}

/**
 * Put each notice in one home section with a stable "when" — no re-sorting by score,
 * so important items never sink below newer noise.
 */
export function placeItem<T extends SectionItem>(item: T, myCourses: Set<string>, now = new Date()): Placed<T> | null {
  const text = `${item.subject}\n${item.summary || ""}`;
  const tags = normalizeTags(item.tags);
  const myCourse = myCourseIn(`${item.subject}\n${item.body || ""}`, myCourses);

  let ev = null;
  try {
    ev = extractEventDetails(item.subject, item.body || item.summary || "");
  } catch {
    ev = null;
  }

  // Deadlines: explicit deadline_at, else a dated "apply/register/submit" notice.
  const deadline =
    item.deadline_at ||
    (ACTION_RE.test(text) ? parseDueDate(`${text}
${item.body || ""}`, now) : null) ||
    (ev && ev.slot_type === "deadline" ? ev.start_time : null);

  if (item.status === "done") return null;
  if (deadline && ACTION_RE.test(text)) {
    if (new Date(deadline).getTime() < now.getTime() - 3600_000) return null; // expired
    return { ...item, section: "action", when: deadline, myCourse };
  }
  if (deadline && item.deadline_at) {
    if (new Date(deadline).getTime() < now.getTime() - 3600_000) return null;
    return { ...item, section: "action", when: deadline, myCourse };
  }

  // Quizzes, exams and tests: their own section, soonest first, gone once they're over.
  // Only notices about an upcoming, dated assessment qualify; everything else stays with the course.
  const looksLikeExam = (EXAM_RE.test(item.subject) || ev?.slot_type === "quiz" || ev?.slot_type === "exam") && !EXAM_AFTERMATH_RE.test(item.subject);
  if (looksLikeExam) {
    // The event parser falls back to "today" when no date is written, so insist on a real date.
    const written = parseDueDate(`${item.subject}\n${(item.body || "").replace(POSTED_LINE_RE, " ")}`, now);
    const examAt = written ? ev?.start_time || written : null;
    if (examAt) {
      if (new Date(examAt).getTime() < now.getTime() - 3 * 3600_000) return null; // over
      return { ...item, section: "exams", when: examAt, myCourse };
    }
  }

  if (myCourse || item.source === "moodle" || item.is_verified) {
    return { ...item, section: "courses", when: ev?.start_time || null, myCourse };
  }

  if (tags.some((t) => t.includes("placement") || t.includes("competition")) || OPPORTUNITY_RE.test(text)) {
    return { ...item, section: "opportunities", when: ev?.start_time || null, myCourse };
  }

  if (ev && (EVENT_RE.test(text) || tags.some((t) => t.includes("fest") || t.includes("talk") || t.includes("sports")))) {
    if (new Date(ev.start_time).getTime() < now.getTime() - 3 * 3600_000) return null; // already happened
    return { ...item, section: "events", when: ev.start_time, myCourse };
  }

  if (item.source === "whatsapp" || tags.some((t) => t.includes("hostel") || t.includes("campus")) || CAMPUS_RE.test(text)) {
    return { ...item, section: "campus", when: null, myCourse };
  }

  if (tags.some((t) => t.includes("fest") || t.includes("talk") || t.includes("sports")) || EVENT_RE.test(text)) {
    return { ...item, section: "events", when: ev?.start_time || null, myCourse };
  }
  return { ...item, section: "campus", when: null, myCourse };
}

const t = (s?: string | null) => (s ? new Date(s).getTime() : 0);

/** tags is jsonb: a list, a comma-separated string (old digest script) or anything else. */
export function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string").map((x) => x.toLowerCase());
  if (typeof raw === "string") return raw.split(/[,;|]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (raw && typeof raw === "object") return Object.keys(raw).map((x) => x.toLowerCase());
  return [];
}

/** One odd notice must never break the board: if placing it fails, it goes to Campus life. */
function safePlace<T extends SectionItem>(i: T, myCourses: Set<string>, now: Date): Placed<T> | null {
  try {
    return placeItem(i, myCourses, now);
  } catch {
    return { ...i, section: "campus", when: null, myCourse: null } as Placed<T>;
  }
}

/** Build every section with a stable order. */
export function buildSections<T extends SectionItem>(items: T[], myCourses: Set<string>, now = new Date()) {
  const placed = items.map((i) => safePlace(i, myCourses, now)).filter(Boolean) as Placed<T>[];
  const by = (k: string) => placed.filter((p) => (p.section as string) === k);
  const newest = (a: Placed<T>, b: Placed<T>) => t(b.received_at) - t(a.received_at);
  const soonest = (a: Placed<T>, b: Placed<T>) => (t(a.when) || Infinity) - (t(b.when) || Infinity) || newest(a, b);

  return {
    action: by("action").sort(soonest),
    exams: by("exams").sort(soonest),
    courses: by("courses").sort(newest),
    events: by("events").sort(soonest),
    opportunities: by("opportunities").sort(newest),
    campus: by("campus").sort(newest),
    // Saved items stay visible here even after their deadline/event has passed.
    saved: items
      .filter((i) => i.status === "kept")
      .map((i) => safePlace(i, myCourses, now) || ({ ...i, section: "campus", when: null, myCourse: null } as Placed<T>))
      .sort(newest),
    all: [...placed].sort(newest),
  } satisfies Record<SectionKey, Placed<T>[]>;
}
