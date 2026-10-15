import { formatCourseCode } from "./slots.ts";

/**
 * Does this student take the course? Uses their saved courses (user_courses);
 * falls back to course codes mentioned in their interest keywords.
 */
export function takesCourse(
  sub: { keywords?: string | null; courses?: string[] | null },
  courseCode: string
): boolean {
  const code = formatCourseCode(courseCode);
  if ((sub.courses || []).some((c) => formatCourseCode(c) === code)) return true;
  const kw = (sub.keywords || "").toUpperCase().replace(/\s+/g, "");
  return kw.includes(code.replace(/\s+/g, ""));
}
