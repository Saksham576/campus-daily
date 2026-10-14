import { createHash } from "node:crypto";
import type { CourseUpdate } from "./timetable/updates.ts";
import { courseCodeOf } from "./timetable/updates.ts";

export type BroadcastInput = {
  subject: string;
  body: string;
  course_code?: string;
  action?: "none" | "cancelled" | "moved" | "added";
  date?: string; // YYYY-MM-DD (IST)
  time?: string; // HH:MM (IST) — the slot affected, or the new/added time
  end_time?: string; // HH:MM
  new_location?: string;
  slot_type?: "quiz" | "exam" | "deadline" | "event";
};

export type Broadcaster = { user_id: string; name: string; role?: string | null; department?: string | null };

const istIso = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString();

/** Validate a broadcast and turn it into an items row + optional verified course update. */
export function buildBroadcast(
  input: BroadcastInput,
  who: Broadcaster,
  now = new Date()
): { row: Record<string, unknown> & { id: string; subject: string; summary: string }; update: CourseUpdate | null } | { error: string } {
  const subject = (input.subject || "").trim();
  const body = (input.body || "").trim();
  if (subject.length < 3 || subject.length > 200) return { error: "Subject must be 3–200 characters." };
  if (body.length > 5000) return { error: "Message is too long (max 5000 characters)." };

  const action = input.action || "none";
  let update: CourseUpdate | null = null;
  const id = "bc_" + createHash("sha256").update(`${who.user_id}|${subject}|${now.toISOString()}`).digest("hex").slice(0, 24);

  if (action !== "none") {
    const code = courseCodeOf(input.course_code || "");
    if (!code) return { error: "Enter a valid course code, e.g. MA 105." };
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Pick a date." };
    const time = input.time && /^\d{2}:\d{2}$/.test(input.time) ? input.time : null;
    const end = input.end_time && /^\d{2}:\d{2}$/.test(input.end_time) ? input.end_time : null;
    const base = { course_code: code, on_date: input.date, notice_id: id, verified: true };

    if (action === "cancelled") update = { ...base, kind: "cancelled", match_start: time ? istIso(input.date, time) : null };
    if (action === "moved") {
      if (!input.new_location && !time) return { error: "Give a new venue or a new time." };
      update = {
        ...base,
        kind: "moved",
        new_location: input.new_location?.trim() || null,
        new_start: time ? istIso(input.date, time) : null,
        new_end: time && end ? istIso(input.date, end) : null,
      };
    }
    if (action === "added") {
      if (!time) return { error: "Give a time for the quiz/exam." };
      const type = input.slot_type || "quiz";
      update = {
        ...base,
        kind: "added",
        new_start: istIso(input.date, time),
        new_end: end ? istIso(input.date, end) : null,
        new_location: input.new_location?.trim() || null,
        slot_type: type,
        title: `${code} ${type.toUpperCase()}`,
      };
    }
  }

  const sender = `${who.name}${who.role ? ` (${who.role}` + (who.department ? `, ${who.department})` : ")") : ""} · Verified`;
  return {
    row: {
      id,
      source: "broadcast",
      subject,
      sender,
      summary: body.slice(0, 280) || subject,
      body,
      links: Array.from(new Set(body.match(/https?:\/\/[^\s<>")\]]+/g) ?? [])).slice(0, 10),
      tags: ["Academics"],
      venue: update?.new_location ?? null,
      deadline_at: update?.slot_type === "deadline" ? update.new_start : null,
      is_personal: false,
      is_verified: true,
      received_at: now.toISOString(),
    },
    update,
  };
}
