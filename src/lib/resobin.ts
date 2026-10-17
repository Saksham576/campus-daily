import { COURSE_CATALOG } from "./timetable/catalog.ts";

export const RESOBIN_SEMESTER = "autumn-2026";

export type ImportedCourse = {
  course_code: string;
  title: string;
  division: string;
  lecture_slots: string[];
  tutorial_slots: string[];
  venue: string | null;
};

const SLOT = /^[A-Z0-9]{1,4}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) : "");

/**
 * Untrusted rows from a student's ResoBin timetable → clean user_courses rows.
 * ResoBin shape: { course: "CH111", division: "D3", lecture_slots: [...], tutorial_slots: [...], lecture_venue: "LA 201" }.
 */
export function parseResobinTimetable(raw: unknown): ImportedCourse[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<string, ImportedCourse>();
  for (const r of raw.slice(0, 40)) {
    if (!r || typeof r !== "object") continue;
    const code = str((r as any).course, 12).toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z]{2,3}\d{3}[A-Z]?$/.test(code)) continue;
    const slots = (v: unknown) => (Array.isArray(v) ? v.map((s) => str(s, 4).toUpperCase()).filter((s) => SLOT.test(s)).slice(0, 12) : []);
    const lecture_slots = slots((r as any).lecture_slots);
    const tutorial_slots = slots((r as any).tutorial_slots);
    if (!lecture_slots.length && !tutorial_slots.length) continue;
    out.set(code, {
      course_code: code,
      title: COURSE_CATALOG[code]?.title || code,
      division: str((r as any).division, 12) || "Core",
      lecture_slots,
      tutorial_slots,
      venue: str((r as any).lecture_venue, 60) || null,
    });
  }
  return [...out.values()];
}
