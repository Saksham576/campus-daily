/**
 * IIT Bombay slot chart, autumn 2026 — taken from ResoBin (resobin.gymkhana.iitb.ac.in).
 * Rows are 30-minute steps from 08:00; day 1 = Monday … 5 = Friday; `end` is exclusive.
 */
type Cell = { day: number; start: number; end: number };

const S: Record<string, Cell> = {
  XE: { day: 1, start: 0, end: 3 },
  "1A": { day: 1, start: 3, end: 5 },
  "2A": { day: 1, start: 5, end: 7 },
  "3A": { day: 1, start: 7, end: 9 },
  "8A": { day: 1, start: 12, end: 15 },
  "9A": { day: 1, start: 15, end: 18 },
  "12A": { day: 1, start: 18, end: 20 },
  "13A": { day: 1, start: 21, end: 24 },
  "4A": { day: 2, start: 0, end: 3 },
  "1B": { day: 2, start: 3, end: 5 },
  "2B": { day: 2, start: 5, end: 7 },
  "3B": { day: 2, start: 7, end: 9 },
  "10A": { day: 2, start: 12, end: 15 },
  "11A": { day: 2, start: 15, end: 18 },
  "12B": { day: 2, start: 18, end: 20 },
  "14A": { day: 2, start: 18, end: 21 },
  "15A": { day: 2, start: 21, end: 24 },
  "5A": { day: 3, start: 0, end: 3 },
  "6A": { day: 3, start: 3, end: 6 },
  "7A": { day: 3, start: 6, end: 9 },
  X1: { day: 3, start: 12, end: 14 },
  X2: { day: 3, start: 14, end: 16 },
  X3: { day: 3, start: 16, end: 18 },
  XC: { day: 3, start: 18, end: 20 },
  "4B": { day: 4, start: 0, end: 3 },
  "1C": { day: 4, start: 3, end: 5 },
  "4C": { day: 4, start: 3, end: 5 },
  "2C": { day: 4, start: 5, end: 7 },
  "3C": { day: 4, start: 7, end: 9 },
  "8B": { day: 4, start: 12, end: 15 },
  "9B": { day: 4, start: 15, end: 18 },
  "12C": { day: 4, start: 18, end: 20 },
  "13B": { day: 4, start: 21, end: 24 },
  "5B": { day: 5, start: 0, end: 3 },
  "6B": { day: 5, start: 3, end: 6 },
  "7B": { day: 5, start: 6, end: 9 },
  "10B": { day: 5, start: 12, end: 15 },
  "11B": { day: 5, start: 15, end: 18 },
  XD: { day: 5, start: 18, end: 20 },
  "14B": { day: 5, start: 18, end: 21 },
  "15B": { day: 5, start: 21, end: 24 },
};

const merge = (...codes: string[]): Cell => ({
  day: S[codes[0]].day,
  start: Math.min(...codes.map((c) => S[c].start)),
  end: Math.max(...codes.map((c) => S[c].end)),
});

/** Lab slots span several lecture slots. */
const LABS: Record<string, Cell> = {
  L1: merge("8A", "9A"),
  L2: merge("10A", "11A"),
  L3: merge("8B", "9B"),
  L4: merge("10B", "11B"),
  L5: merge("6A", "7A"),
  L6: merge("6B", "7B"),
  L7: merge("1A", "2A", "3A"),
  L8: merge("1B", "2B", "3B"),
  L9: merge("1C", "2C", "3C"),
  LX: merge("X1", "X2", "X3"),
};

/**
 * CS 101 labs don't follow the slot chart. Bodhitree (Lab Exam 2 notice, 23 Oct 2026) gives the regular weekly
 * lab hours by lab batch: P13, P14 Tue 08:15 · P19, P21 Tue 10:30 · P15, P16 Thu 08:15 · P20, P22 Thu 10:30.
 * Each lab is two hours (the 25 Oct compensatory lab ran 08:15–10:15).
 */
const CS101_LABS: Record<string, { day: number; start: string; end: string; batches: string[] }> = {
  C1: { day: 2, start: "08:15", end: "10:15", batches: ["P13", "P14"] },
  C2: { day: 2, start: "10:30", end: "12:30", batches: ["P19", "P21"] },
  C3: { day: 4, start: "08:15", end: "10:15", batches: ["P15", "P16"] },
  C4: { day: 4, start: "10:30", end: "12:30", batches: ["P20", "P22"] },
};

/** The CS 101 lab slot code for a lab batch ("P16" -> "C3"), if we know it. */
export const cs101LabFor = (batch?: string | null): string | null =>
  Object.entries(CS101_LABS).find(([, v]) => v.batches.includes((batch || "").trim().toUpperCase()))?.[0] ?? null;

const rowTime = (row: number) => {
  const mins = 8 * 60 + row * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];

/** The institute's lab slots as choices a student can read: "Tue 14:00–17:00 (L1)". */
export function labSlotOptions(): { code: string; label: string }[] {
  return Object.keys(LABS)
    .map((code) => ({ code, t: slotTime(code)! }))
    .sort((a, b) => a.t.day - b.t.day || a.t.start.localeCompare(b.t.start))
    .map(({ code, t }) => ({ code, label: `${DAY_NAMES[t.day]} ${t.start}–${t.end}` }));
}

/** CS 101 lab choices, for students whose lab batch we can't read from Moodle: "Thu 08:15–10:15 (batches P15, P16)". */
export function cs101LabOptions(): { code: string; label: string }[] {
  return Object.entries(CS101_LABS).map(([code, v]) => ({ code, label: `${DAY_NAMES[v.day]} ${v.start}–${v.end} (batches ${v.batches.join(", ")})` }));
}

/** Tutorial slots (X1, X2…) as readable choices. Which one is yours depends on your tutorial batch (T1, T8…). */
export function tutorialSlotOptions(): { code: string; label: string }[] {
  return ["X1", "X2", "X3", "XC", "XD", "XE"]
    .filter((c) => S[c])
    .map((code) => ({ code, t: slotTime(code)! }))
    .sort((a, b) => a.t.day - b.t.day || a.t.start.localeCompare(b.t.start))
    .map(({ code, t }) => ({ code, label: `${DAY_NAMES[t.day]} ${t.start}–${t.end}` }));
}

/** True for lab slot codes (L1…L9, LX). */
export const isLabSlotCode = (code: string) => code.toUpperCase() in LABS || code.toUpperCase() in CS101_LABS;

export type SlotTime = { day: number; start: string; end: string; isLab: boolean };

export function slotTime(code: string): SlotTime | null {
  const key = code.trim().toUpperCase();
  const cs = CS101_LABS[key];
  if (cs) return { day: cs.day, start: cs.start, end: cs.end, isLab: true };
  const cell = LABS[key] || S[key];
  return cell ? { day: cell.day, start: rowTime(cell.start), end: rowTime(cell.end), isLab: key in LABS } : null;
}

/**
 * Merge consecutive lecture slots on the same day (e.g. a P-batch lab given as 1A 2A 3A)
 * into one block, so the timetable shows one session instead of three.
 */
export function sessionsFor(slots: string[]): SlotTime[] {
  const times = slots.map(slotTime).filter(Boolean) as SlotTime[];
  times.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  const out: SlotTime[] = [];
  for (const t of times) {
    const last = out[out.length - 1];
    if (last && last.day === t.day && last.end === t.start) last.end = t.end;
    else out.push({ ...t });
  }
  return out;
}

/** "MA105" -> "MA 105" (matches courseCodeOf used by timetable updates). */
export function formatCourseCode(code: string): string {
  const m = code.toUpperCase().replace(/\s+/g, "").match(/^([A-Z]{2,3})(\d{3}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : code.toUpperCase().trim();
}

/** Monday–Friday dates (YYYY-MM-DD, IST) of the week containing `now`. */
export function weekDatesIST(now = new Date()): string[] {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const dow = ist.getUTCDay() || 7; // 1 = Mon … 7 = Sun
  const monday = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - (dow - 1)));
  return [0, 1, 2, 3, 4].map((i) => new Date(monday.getTime() + i * 86400000).toISOString().slice(0, 10));
}

export type UserCourse = {
  course_code: string;
  title?: string | null;
  division?: string | null;
  lecture_slots: string[];
  tutorial_slots: string[];
  venue?: string | null;
};

export type WeekSlot = {
  id: string;
  title: string;
  location: string | null;
  start_time: string;
  end_time: string;
  slot_type: "lecture" | "lab";
  /** The student's division for this course (D3, P16…), so notices aimed at one division can skip the others. */
  division?: string | null;
};

/** A student's week built from their courses + the slot chart. */
export function buildWeek(courses: UserCourse[], now = new Date()): WeekSlot[] {
  const dates = weekDatesIST(now);
  const out: WeekSlot[] = [];
  for (const c of courses) {
    const code = formatCourseCode(c.course_code);
    const label = c.title ? `${code}: ${c.title}` : code;
    // CS 101 with no lab slot of its own: take it from the student's lab batch (the P-batch on their Physics lab row).
    const lecture = [...(c.lecture_slots || [])];
    if (code === "CS 101" && !lecture.some(isLabSlotCode)) {
      const batch = courses.map((x) => x.division).find((d) => /^P\d+$/i.test((d || "").trim()));
      const lab = cs101LabFor(batch);
      if (lab) lecture.push(lab);
    }
    const parts: [string[], string][] = [
      [lecture, ""],
      [c.tutorial_slots || [], " (Tutorial)"],
    ];
    for (const [slots, suffix] of parts) {
      for (const s of sessionsFor(slots)) {
        const date = dates[s.day - 1];
        out.push({
          id: `course-${code}-${s.day}-${s.start}${suffix ? "-tut" : ""}`,
          // A lab block gets its own name so it isn't mistaken for the lecture.
          title: s.isLab && !/lab/i.test(c.title || "") ? (c.title ? `${code}: ${c.title} Lab` : `${code} Lab`) : label + suffix,
          location: c.venue || null,
          start_time: new Date(`${date}T${s.start}:00+05:30`).toISOString(),
          end_time: new Date(`${date}T${s.end}:00+05:30`).toISOString(),
          slot_type: s.isLab || /lab/i.test(c.title || "") ? "lab" : "lecture",
          division: c.division || null,
        });
      }
    }
  }
  return out.sort((a, b) => a.start_time.localeCompare(b.start_time));
}
