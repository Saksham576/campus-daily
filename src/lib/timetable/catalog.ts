import { RESOBIN_AUTUMN_2026 } from "./catalog-autumn-2026.ts";
/**
 * Autumn 2026 timetable for first-year-level courses, copied from ResoBin on 2026-10-15.
 * d = division / batch, l = lecture slots, t = tutorial slots, v = venue.
 * Courses not listed here can still be added with their slot codes from ResoBin / ASC.
 */
export type CatalogDivision = { d: string; l: string[]; t: string[]; v: string };
export type CatalogCourse = { title: string; credits: number; dept?: string; divisions: CatalogDivision[] };

const HAND_CATALOG: Record<string, CatalogCourse> = {
  AE103: { title: "A historical perspective of Aerospace Engineering", credits: 6, divisions: [{ d: "Core", l: ["11A", "11B"], t: [], v: "" }, { d: "D2", l: ["11A", "11B"], t: [], v: "" }] },
  AE152: { title: "Introduction to Aerospace Engg.", credits: 6, divisions: [{ d: "Core", l: ["5A", "5B"], t: [], v: "" }] },
  AE153: { title: "Introduction to Aerospace Engg.", credits: 6, divisions: [{ d: "Minor", l: ["5A", "5B"], t: [], v: "" }] },
  BB101: { title: "Biology", credits: 6, divisions: [{ d: "D1", l: ["6A", "6B"], t: ["12A"], v: "LT 206" }, { d: "D2", l: ["10A", "10B"], t: ["X3"], v: "LT 304" }, { d: "S1", l: ["7A", "7B"], t: [], v: "LA 202" }] },
  CE103: { title: "Introduction to Civil Engineering", credits: 6, divisions: [{ d: "Core", l: ["11A", "11B", "4A"], t: [], v: "LC 301" }, { d: "D2", l: ["11A", "11B", "12B"], t: [], v: "" }] },
  CH111: { title: "Chemistry", credits: 8, divisions: [{ d: "D1", l: ["2A", "2B", "2C"], t: ["X2"], v: "LT 006" }, { d: "D2", l: ["8A", "8B"], t: ["X2"], v: "LT 302" }, { d: "D3", l: ["3A", "3B", "3C"], t: [], v: "LA 201" }, { d: "D4", l: ["9A", "9B"], t: ["X1"], v: "LT 004" }] },
  CH117: { title: "Chemistry Lab", credits: 3, divisions: [{ d: "P1", l: ["L2"], t: [], v: "" }, { d: "P10", l: ["1A", "2A", "3A"], t: [], v: "" }, { d: "P2", l: ["L4"], t: [], v: "" }, { d: "P3", l: ["L1"], t: [], v: "" }, { d: "P4", l: ["L3"], t: [], v: "" }, { d: "P7", l: ["1B", "2B", "3B"], t: [], v: "" }, { d: "P8", l: ["1C", "2C", "3C"], t: [], v: "" }, { d: "P9", l: ["6B", "7B"], t: [], v: "" }] },
  CS101: { title: "Computer Programming and Utilization", credits: 6, divisions: [{ d: "D3", l: ["7A", "7B"], t: [], v: "LA 201" }, { d: "D4", l: ["10A", "10B"], t: [], v: "LA 202" }] },
  CS105: { title: "Discrete Structures", credits: 6, divisions: [{ d: "Core", l: ["6A", "6B"], t: [], v: "LH 301" }, { d: "D3", l: ["6A", "6B"], t: [], v: "LH 301" }] },
  DE109: { title: "Introduction to Design", credits: 4, divisions: [{ d: "S1", l: ["12A", "12B", "12C"], t: [], v: "LC 302" }, { d: "S2", l: ["5A", "5B"], t: [], v: "LC 302" }] },
  EE103: { title: "Introduction to Electrical Engineering", credits: 6, divisions: [{ d: "Core", l: ["11A", "11B"], t: [], v: "LH 301" }, { d: "D4", l: ["11A", "11B"], t: [], v: "LH 301" }] },
  EN110: { title: "Energy Engineering Fundamentals", credits: 6, divisions: [{ d: "Core", l: ["1A", "1B", "1C"], t: [], v: "" }, { d: "D1", l: ["1A", "1B", "1C"], t: [], v: "" }] },
  // SOM101 (HASMED): not in the ResoBin copy; slots follow the shared HASMED pattern (S1 = 12A/B/C, S2 = 5A/B). Venue unknown.
  SOM101: { title: "Introduction to Management", credits: 4, divisions: [{ d: "S1", l: ["12A", "12B", "12C"], t: [], v: "" }, { d: "S2", l: ["5A", "5B"], t: [], v: "" }] },
  ENT101: { title: "Introduction to Innovation & Entrepreneurship", credits: 4, divisions: [{ d: "Core", l: ["5A", "5B"], t: [], v: "LH 301" }] },
  ES101: { title: "Introduction to Environmental Science & Engineering", credits: 6, divisions: [{ d: "Core", l: ["1A", "1B", "1C"], t: [], v: "LT 305" }, { d: "D1", l: ["1A", "1B", "1C"], t: [], v: "LT 305" }] },
  HS108: { title: "Doing Sociology", credits: 4, divisions: [{ d: "S1", l: ["12A", "12B", "12C"], t: [], v: "LC 201" }, { d: "S2", l: ["5A", "5B"], t: [], v: "LC 201" }] },
  HS109: { title: "Introduction to Philosophy", credits: 4, divisions: [{ d: "S1", l: ["12A", "12B", "12C"], t: [], v: "LC 202" }, { d: "S2", l: ["5A", "5B"], t: [], v: "LC 202" }] },
  HS113: { title: "Academic English", credits: 8, divisions: [{ d: "Core", l: ["12B", "5A", "5B"], t: [], v: "LT 302" }] },
  MA105: { title: "Calculus", credits: 8, divisions: [{ d: "D1", l: ["3A", "3B", "3C"], t: [], v: "LA 202" }, { d: "D2", l: ["9A", "9B"], t: ["X1"], v: "LT 203" }, { d: "D3", l: ["2A", "2B", "2C"], t: ["X1"], v: "LT 204" }, { d: "D4", l: ["8A", "8B"], t: ["X2"], v: "LT 206" }] },
  MA113: { title: "Mathematics and Its History", credits: 6, divisions: [{ d: "Core", l: ["11A", "11B"], t: [], v: "LT 304" }, { d: "D4", l: ["11A", "11B"], t: [], v: "LT 304" }] },
  ME103: { title: "Mechanical Department Introductory Course I", credits: 6, divisions: [{ d: "Core", l: ["1A", "1B", "1C"], t: [], v: "LA 202" }, { d: "D1", l: ["1A", "1B", "1C"], t: [], v: "LA 202" }] },
  MS101: { title: "Makerspace", credits: 8, divisions: [{ d: "P1", l: ["L1", "L3"], t: [], v: "" }, { d: "P10", l: ["1B", "1C", "2B", "2C", "3B", "3C"], t: [], v: "" }, { d: "P2", l: ["L1", "L3"], t: [], v: "" }, { d: "P3", l: ["L2", "L4"], t: [], v: "" }, { d: "P4", l: ["L2", "L4"], t: [], v: "" }, { d: "P7", l: ["1A", "2A", "3A", "6B", "7B"], t: [], v: "" }, { d: "P8", l: ["1A", "2A", "3A", "6B", "7B"], t: [], v: "" }, { d: "P9", l: ["1B", "1C", "2B", "2C", "3B", "3C"], t: [], v: "" }] },
  PH109: { title: "Fundamental Themes in Physics", credits: 6, divisions: [{ d: "Core", l: [], t: ["12A"], v: "LT 205" }, { d: "D2", l: ["11A", "11B"], t: [], v: "LT 306" }] },
  PH113: { title: "Oscillations and Waves", credits: 6, divisions: [{ d: "Core", l: ["1A", "1B", "1C"], t: [], v: "LH 301" }] },
  PH114: { title: "Thermal Physics", credits: 6, divisions: [{ d: "Core", l: ["1A", "1B", "1C"], t: [], v: "LH 301" }] },
  PH117: { title: "Physics Lab", credits: 3, divisions: [{ d: "P13", l: ["L1"], t: [], v: "" }, { d: "P14", l: ["L2"], t: [], v: "" }, { d: "P15", l: ["L3"], t: [], v: "" }, { d: "P16", l: ["L4"], t: [], v: "" }, { d: "P19", l: ["1A", "2A", "3A"], t: [], v: "" }, { d: "P20", l: ["1B", "2B", "3B"], t: [], v: "" }, { d: "P21", l: ["1C", "2C", "3C"], t: [], v: "" }, { d: "P22", l: ["6B", "7B"], t: [], v: "" }] },
};

/** Every autumn-2026 course from ResoBin (all departments and years); hand entries fill gaps. */
export const COURSE_CATALOG: Record<string, CatalogCourse> = { ...HAND_CATALOG, ...RESOBIN_AUTUMN_2026 };

export function catalogKey(code: string): string {
  return code.toUpperCase().replace(/\s+/g, "");
}

/**
 * Courses to add to a student's timetable from their Moodle course shortnames
 * ("CH 111-2026-1-D3", "PH 117-2026-1-P16", "ENT101-2026-1"). Only when the catalog knows that division
 * (or the course has a single "Core" offering); "-ALL" umbrella pages are skipped.
 */
export function coursesFromShortnames(shortnames: string[]): { course_code: string; title: string; division: string; lecture_slots: string[]; tutorial_slots: string[]; venue: string | null }[] {
  const out = new Map<string, { course_code: string; title: string; division: string; lecture_slots: string[]; tutorial_slots: string[]; venue: string | null }>();
  for (const sn of shortnames) {
    const m = sn.toUpperCase().match(/^\s*([A-Z]{2,3})\s?(\d{3}[A-Z]?)-\d{4}-\d(?:-([A-Z0-9]+))?/);
    if (!m) continue;
    const key = `${m[1]}${m[2]}`;
    const course = COURSE_CATALOG[key];
    if (!course) continue;
    const div = m[3] && m[3] !== "ALL" ? course.divisions.find((d) => d.d.toUpperCase() === m[3]) : course.divisions.length === 1 ? course.divisions[0] : undefined;
    if (!div || (div.l.length === 0 && div.t.length === 0)) continue;
    if (out.has(key) && !m[3]) continue; // a specific division wins over the umbrella guess
    out.set(key, { course_code: key, title: course.title, division: div.d, lecture_slots: div.l, tutorial_slots: div.t, venue: div.v || null });
  }
  return [...out.values()];
}

/**
 * Courses every first-year student of a division takes (those offered to two or more of D1–D4,
 * e.g. MA 105, CH 111, CS 101, BB 101), so the timetable isn't empty before Moodle is connected.
 * Labs, HASMED electives and department courses need Moodle or a manual add.
 */
export function coursesForDivision(division: string | null | undefined) {
  const d = (division || "").toUpperCase();
  if (!/^D\d$/.test(d)) return [];
  const out: { course_code: string; title: string; division: string; lecture_slots: string[]; tutorial_slots: string[]; venue: string | null }[] = [];
  for (const [key, c] of Object.entries(COURSE_CATALOG)) {
    const shared = c.divisions.filter((x) => /^D\d$/.test(x.d)).length >= 2;
    const mine = c.divisions.find((x) => x.d === d);
    if (shared && mine) out.push({ course_code: key, title: c.title, division: d, lecture_slots: mine.l, tutorial_slots: mine.t, venue: mine.v || null });
  }
  return out;
}
