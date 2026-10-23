import { buildWeek, type UserCourse, type WeekSlot } from "./slots.ts";
import { applyCourseUpdates, istDate, withPersonalOverrides, type CourseUpdate, type Slot } from "./updates.ts";

import { SEMESTER } from "./semester.ts";
export { SEMESTER };

const DAY = 86400000;
const IST_MS = 5.5 * 3600 * 1000;

/** Monday (YYYY-MM-DD, IST) of the week containing `d`. */
export function mondayOf(d: Date): string {
  const ist = new Date(d.getTime() + IST_MS);
  const dow = ist.getUTCDay() || 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - (dow - 1))).toISOString().slice(0, 10);
}

export const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);

/** Weeks shown: one back, this one, and four ahead (so about a month of "what's coming"). */
export const WEEKS_BACK = 1;
export const WEEKS_AHEAD = 5;

export type RangeSlot = Slot & { user_id?: string; slot_type: string };

/**
 * Classes for a run of weeks: the slot chart for each week, with course-level notices (cancellations,
 * moved rooms, quizzes, holidays) applied, then the student's own saved slots on top.
 * Lectures after the last day of instruction are dropped (exams are listed separately).
 */
export function buildRange(
  courses: UserCourse[],
  updates: CourseUpdate[],
  saved: RangeSlot[],
  now = new Date(),
  opts: { back?: number; ahead?: number; lecturesEnd?: string } = {}
): RangeSlot[] {
  const back = opts.back ?? WEEKS_BACK;
  const ahead = opts.ahead ?? WEEKS_AHEAD;
  const lecturesEnd = opts.lecturesEnd ?? SEMESTER.lecturesEnd;
  const thisMonday = mondayOf(now);
  const base: WeekSlot[] = [];
  for (let w = -back; w <= ahead; w++) {
    const ref = new Date(Date.parse(addDays(thisMonday, w * 7) + "T06:00:00Z"));
    base.push(...buildWeek(courses, ref));
  }
  const lectures = base
    .filter((s) => istDate(s.start_time) <= lecturesEnd)
    .map((s) => ({ ...s, is_cancelled: false })) as RangeSlot[];
  const updated = applyCourseUpdates(lectures, updates) as RangeSlot[];
  return withPersonalOverrides(updated, saved);
}

export type WeekInfo = { offset: number; monday: string; sunday: string; tentative: boolean; afterLectures: boolean; examWeek: boolean };

/** What kind of week is `offset` weeks from now. */
export function weekInfo(offset: number, now = new Date()): WeekInfo {
  const monday = addDays(mondayOf(now), offset * 7);
  return {
    offset,
    monday,
    sunday: addDays(monday, 6),
    tentative: offset > 0,
    afterLectures: monday > SEMESTER.lecturesEnd,
    examWeek: monday >= SEMESTER.endSemStart && monday <= SEMESTER.endSemEnd,
  };
}
