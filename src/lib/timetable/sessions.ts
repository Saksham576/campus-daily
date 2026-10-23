import type { CourseUpdate } from "./updates.ts";
import { dayIn } from "./holiday.ts";
import { SEMESTER } from "./semester.ts";

/**
 * Course notices that change what a student's week looks like beyond one cancelled class:
 *  - "we are no longer having CS101 lectures"  -> the course's lectures are off until the semester ends;
 *  - "doubt-solving session, Fri 23 Oct, 14:00, KR-225, KReSIT"  -> an extra session with its time and room,
 *    for the division the notice names (D3 / D4) or everyone if it names none.
 * One notice can carry both, so this returns a list.
 */

const IST_MS = 5.5 * 3600 * 1000;

/** Forum mails are HTML (<br>, <p>, &nbsp;). */
export function plainText(s: string): string {
  return s
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&emsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ");
}

// Bodhitree writes "CS101A26" (course + offering): read it as CS101.
const normCode = (s: string) => s.replace(/\b([A-Z]{2,3}\d{3})[A-Z]\d{2}\b/g, "$1 ");
const COURSE_RE = /\b(?!(?:LA|LT|LH|LC|SIC|PC|CC|MB|KR|VMCC)\b)([A-Z]{2,3})\s?(\d{3}[A-Z]?)\b/;
const courseOf = (s: string) => {
  const m = s.match(COURSE_RE);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
};

const NO_LONGER_RE =
  /\b(?:no longer (?:having|holding|conducting|running)|(?:will|shall) not (?:be )?(?:held|conducted) (?:any ?more|from now)|(?:are|is|have been|has been) (?:discontinued|stopped))\b[^.!?\n]{0,60}\b(?:lectures?|classes)\b|\b(?:lectures?|classes)\b[^.!?\n]{0,40}\b(?:are|is|have been|has been) (?:discontinued|stopped)\b/i;
const DATE_WORD_RE = /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}|today|tomorrow|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i;

const SESSION_RE = /\b(doubt[- ]?(?:solving|clearing)?|extra|make-?up|compensatory|revision|review|special|catch-?up|remedial)\s+(session|class|lecture|lab|tutorial)\b/i;

const ROOM_RE = /\b((?:KR|LA|LT|LC|LH|SIC|CC|MB|PC|VMCC)[- ]?\d{1,3}[A-Z]?)\b/;
const BUILDING_RE = /\b(KReSIT|New CSE|Convocation Hall|Main Building|Physics|Chemistry|Mechanical|Electrical)\b(?:\s+Building)?/i;

/** "KR-225, 2nd Floor, KReSIT Building" from the sentence that gives the room. */
export function locationFrom(text: string): string | null {
  const m = text.match(ROOM_RE);
  if (!m) return null;
  const near = text.slice(m.index!, m.index! + 110);
  const floor = near.match(/\b(\d(?:st|nd|rd|th)\s+Floor)\b/i)?.[1];
  const b = near.match(BUILDING_RE);
  const building = b ? (/building$/i.test(b[0]) ? b[0] : `${b[0]} Building`) : null;
  const room = m[1].toUpperCase().replace(/^([A-Z]+)(\d)/, "$1-$2").replace(/^(LA|LT|LC|LH|SIC|CC|MB|PC)-(\d)/, "$1 $2");
  return [room, floor, building].filter(Boolean).join(", ");
}

/** First clock time (and optional end) in the text, as 24-hour numbers. */
export function clockIn(text: string): { sh: number; sm: number; eh?: number; em?: number } | null {
  const m = text.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?(?:\s*(?:hrs?|hours))?(?:\s*(?:to|-|–)\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?)?/i);
  if (!m) return null;
  const to24 = (h: number, mer?: string) => (mer?.toLowerCase() === "pm" && h < 12 ? h + 12 : mer?.toLowerCase() === "am" && h === 12 ? 0 : h);
  const endMer = m[6] || m[3];
  const out: { sh: number; sm: number; eh?: number; em?: number } = { sh: to24(+m[1], m[3] || (m[6] && +m[1] <= +m[4] ? m[6] : undefined)), sm: +m[2] };
  if (m[4]) {
    out.eh = to24(+m[4], endMer);
    out.em = +m[5];
  }
  if (out.sh > 23 || out.sm > 59) return null;
  return out;
}

export const divisionFrom = (s: string): string | null => {
  const m = s.match(/\b(D[1-9])\s*(?:batch|division|section)\b|\b(?:batch|division|section)\s*(D[1-9])\b|\bdear\s+(D[1-9])\b/i);
  return m ? (m[1] || m[2] || m[3]).toUpperCase() : null;
};

const label = (kind: string, what: string) => {
  const k = kind.toLowerCase().replace(/[- ]+/g, " ").replace(/\bsolving\b/, "solving").trim();
  const nice = /doubt/.test(k) ? "Doubt-solving" : k.replace(/\b\w/g, (c) => c.toUpperCase());
  return `${nice} ${what.toLowerCase()}`;
};

export function sessionUpdates(subject: string, rawBody: string, noticeId: string | undefined, receivedAt: Date): CourseUpdate[] {
  if (/^\s*\[(s\.events|student-notices)\]/i.test(subject)) return [];
  const subj = normCode(plainText(subject));
  const body = normCode(plainText(rawBody)).slice(0, 3000);
  const code = courseOf(subj) || courseOf(body.slice(0, 600));
  if (!code) return [];
  const today = new Date(receivedAt.getTime() + IST_MS).toISOString().slice(0, 10);
  const out: CourseUpdate[] = [];

  // 1) Lectures discontinued for the rest of the semester.
  const gone = body.match(NO_LONGER_RE);
  if (gone && !DATE_WORD_RE.test(gone[0])) {
    out.push({ course_code: code, kind: "cancelled", on_date: today, until_date: SEMESTER.lecturesEnd, slot_type: "lecture", match_start: null, notice_id: noticeId ?? null });
  }

  // 2) An extra session with a written date and time.
  const sm = subj.match(SESSION_RE) || body.match(SESSION_RE);
  if (sm) {
    const date = dayIn(subj, receivedAt) || dayIn(body, receivedAt);
    // The time sits next to the date in the sentence; look there first so room numbers can't be mistaken for it.
    const at = body.search(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i);
    const clock = clockIn(at >= 0 ? body.slice(at, at + 80) : "") || clockIn(subj) || clockIn(body);
    if (date && date >= today && clock) {
      const start = new Date(`${date}T${String(clock.sh).padStart(2, "0")}:${String(clock.sm).padStart(2, "0")}:00+05:30`);
      const end = clock.eh !== undefined ? new Date(`${date}T${String(clock.eh).padStart(2, "0")}:${String(clock.em ?? 0).padStart(2, "0")}:00+05:30`) : new Date(start.getTime() + 3600_000);
      out.push({
        course_code: code,
        kind: "added",
        on_date: date,
        new_start: start.toISOString(),
        new_end: end.toISOString(),
        new_location: locationFrom(body),
        slot_type: "session",
        title: `${code} ${label(sm[1], sm[2])}`,
        division: divisionFrom(subj) || divisionFrom(body.slice(0, 400)),
        notice_id: noticeId ?? null,
      });
    }
  }
  return out;
}
