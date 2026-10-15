import { DIVISION_SLOTS, HASMED_SLOTS } from "./first_year_slots.ts";

/** Course codes in a student's baseline timetable (division + HASMED elective). */
export function baselineCourses(division?: string | null, hasmed?: string | null): Set<string> {
  const slots = [...(division ? DIVISION_SLOTS[division] || [] : []), ...(hasmed ? HASMED_SLOTS[hasmed] || [] : [])];
  return new Set(slots.map((s) => s.course_code.toUpperCase()));
}

/** Does this student take the course? Baseline timetable or their keywords mention it. */
export function takesCourse(
  sub: { division?: string | null; hasmed?: string | null; keywords?: string | null },
  courseCode: string
): boolean {
  const code = courseCode.toUpperCase();
  if (baselineCourses(sub.division, sub.hasmed).has(code)) return true;
  const kw = (sub.keywords || "").toUpperCase().replace(/\s+/g, "");
  return kw.includes(code.replace(/\s+/g, ""));
}
