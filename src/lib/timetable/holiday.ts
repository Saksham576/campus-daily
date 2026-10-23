import type { CourseUpdate } from "./updates.ts";

/** course_updates.course_code for a change that applies to every course ("Institute holiday on 20 October"). */
export const ALL_COURSES = "*";

const IST_MS = 5.5 * 3600 * 1000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

// Everyone-off notices: a holiday, or all classes suspended. Course-specific notices never match.
const HOLIDAY_RE = new RegExp(
  [
    "\\b(institute|campus|public|gazetted|national)\\s+holiday\\b",
    "\\bholiday\\s+(?:on|for|tomorrow|today)\\b",
    "\\b(?:tomorrow|today)\\s+is\\s+a\\s+holiday\\b",
    "\\b(?:all\\s+)?(?:classes|lectures|academic\\s+activities)\\s+(?:will\\s+be\\s+|are\\s+|shall\\s+be\\s+|stand\\s+)?(?:suspended|cancelled|canceled)\\s+(?:for\\s+all|on|tomorrow|today)\\b",
    "\\bno\\s+(?:classes|lectures)\\s+(?:for\\s+(?:all|anyone|everyone)|on\\s+account\\s+of)\\b",
    "\\binstitute\\s+(?:will\\s+)?(?:remain\\s+)?closed\\b",
  ].join("|"),
  "i"
);
const COURSE_IN_SUBJECT_RE = /\b(?!(?:LA|LT|LH|SIC|PC|LC|CC|MB)\b)[A-Z]{2,3}\s?\d{3}[A-Z]?\b/;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const istDay = (d: Date) => ymd(new Date(d.getTime() + IST_MS));
const addDays = (day: string, n: number) => ymd(new Date(Date.parse(day + "T00:00:00Z") + n * 86400000));

/** The day a holiday notice is about, as written in it. */
export function dayIn(text: string, receivedAt: Date): string | null {
  const today = istDay(receivedAt);
  const year = Number(today.slice(0, 4));
  const dm = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s*(\\d{4}))?`, "i"));
  const md = text.match(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, "i"));
  const num = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  let d = 0, m = -1, y = year;
  if (dm) [d, m, y] = [+dm[1], MONTHS.findIndex((x) => dm[2].toLowerCase().startsWith(x)), dm[3] ? +dm[3] : year];
  else if (md) [d, m, y] = [+md[2], MONTHS.findIndex((x) => md[1].toLowerCase().startsWith(x)), md[3] ? +md[3] : year];
  else if (num) [d, m, y] = [+num[1], +num[2] - 1, +num[3]];
  if (m >= 0 && d >= 1 && d <= 31) {
    const real = new Date(Date.UTC(y, m, d));
    if (real.getUTCMonth() === m) return ymd(real);
  }
  if (/\btomorrow\b/i.test(text)) return addDays(today, 1);
  if (/\btoday\b/i.test(text)) return today;
  return null;
}

/** "Institute holiday on 20 October" -> every class that day is off. */
export function holidayFromNotice(subject: string, body: string, noticeId: string | undefined, receivedAt: Date): CourseUpdate | null {
  if (COURSE_IN_SUBJECT_RE.test(subject) || /^\s*\[(s\.events|student-notices)\]/i.test(subject)) return null;
  const text = `${subject}\n${body.slice(0, 1500)}`;
  if (!HOLIDAY_RE.test(text)) return null;
  const day = dayIn(subject, receivedAt) || dayIn(body.slice(0, 1500), receivedAt);
  if (!day || day < istDay(receivedAt)) return null;
  return { course_code: ALL_COURSES, kind: "cancelled", on_date: day, until_date: day, match_start: null, notice_id: noticeId ?? null };
}
