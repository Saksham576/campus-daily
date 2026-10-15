import { buildWeek, formatCourseCode, type UserCourse } from "./timetable/slots.ts";
import type { CourseUpdate } from "./timetable/updates.ts";

const DAY_MS = 86400000;
const IST_MS = 5.5 * 3600 * 1000;

export type ReminderSub = {
  email: string;
  name?: string | null;
  personal_email?: string | null;
  division?: string | null;
  hasmed?: string | null;
  onboarded_at?: string | null;
  last_seen_at?: string | null;
  last_reminded_at?: string | null;
  user_id?: string | null;
};

/** Inactive 3+ days and not reminded in the last 3 days. */
export function needsReminder(s: ReminderSub, now = new Date()): boolean {
  if (!s.onboarded_at) return false;
  const seen = new Date(s.last_seen_at || s.onboarded_at).getTime();
  const reminded = s.last_reminded_at ? new Date(s.last_reminded_at).getTime() : 0;
  return now.getTime() - seen >= 3 * DAY_MS && now.getTime() - reminded >= 3 * DAY_MS;
}

export type TodayClass = { time: string; course: string; title: string; location: string; note?: string };

/** Today's classes (IST) from the student's courses + slot chart, with notice-based changes applied. */
export function todaysClasses(courses: UserCourse[], updates: CourseUpdate[], now = new Date()): TodayClass[] {
  const date = new Date(now.getTime() + IST_MS).toISOString().slice(0, 10);
  const slots = buildWeek(courses, now).filter((x) => istDateOf(x.start_time) === date);
  const todays = updates.filter((u) => u.on_date === date);
  const out: TodayClass[] = slots.map((x) => {
    const code = x.title.split(":")[0].replace(" (Tutorial)", "");
    const c: TodayClass = {
      time: istTimeOf(x.start_time),
      course: code,
      title: x.title.includes(":") ? x.title.split(": ").slice(1).join(": ") : "",
      location: x.location || "",
    };
    for (const u of todays.filter((u) => u.course_code === code)) {
      if (u.kind === "cancelled") c.note = "Cancelled";
      if (u.kind === "moved" && u.new_location) {
        c.location = u.new_location;
        c.note = "Venue changed";
      }
    }
    return c;
  });
  const mine = new Set(courses.map((c) => formatCourseCode(c.course_code)));
  for (const u of todays) {
    if (u.kind === "added" && u.new_start && mine.has(u.course_code)) {
      out.push({ time: istTimeOf(u.new_start), course: u.course_code, title: (u.slot_type || "event").toUpperCase(), location: u.new_location || "", note: "New" });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

const istDateOf = (iso: string) => new Date(new Date(iso).getTime() + IST_MS).toISOString().slice(0, 10);
const istTimeOf = (iso: string) => new Date(new Date(iso).getTime() + IST_MS).toISOString().slice(11, 16);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function reminderEmail(
  s: ReminderSub,
  classes: TodayClass[],
  notices: { subject: string; summary?: string | null }[],
  appUrl = "https://campusdaily.nexuspulsetech.com"
): { subject: string; html: string; text: string } {
  const first = (s.name || "").split(" ")[0] || "there";
  const rows = classes.length
    ? classes
        .map(
          (c) =>
            `<tr><td style="padding:4px 8px">${esc(c.time)}</td><td style="padding:4px 8px"><b>${esc(c.course)}</b> ${esc(c.title)}</td><td style="padding:4px 8px">${esc(c.location)}</td><td style="padding:4px 8px;color:#C8401F">${esc(c.note || "")}</td></tr>`
        )
        .join("")
    : `<tr><td style="padding:4px 8px">No classes today 🎉</td></tr>`;
  const list = notices.map((n) => `<li><b>${esc(n.subject)}</b>${n.summary ? ` — ${esc(n.summary)}` : ""}</li>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
<p>Hi ${esc(first)}, here's your day at IIT Bombay.</p>
<h3 style="margin-bottom:4px">Today's timetable</h3>
<table style="border-collapse:collapse;font-size:14px">${rows}</table>
${list ? `<h3 style="margin-bottom:4px">Notices you may have missed</h3><ul style="font-size:14px">${list}</ul>` : ""}
<p><a href="${appUrl}" style="color:#C8401F">Open Campus Daily</a> · You get this because you haven't opened the app in 3 days. <a href="${appUrl}/settings">Settings</a></p>
</div>`;
  const text = `Hi ${first}, here's your day.\n\n${classes.map((c) => `${c.time} ${c.course} ${c.title} @ ${c.location}${c.note ? ` (${c.note})` : ""}`).join("\n") || "No classes today."}\n\n${notices.map((n) => `- ${n.subject}`).join("\n")}\n\n${appUrl}`;
  return { subject: classes.some((c) => c.note) ? "Your timetable changed today — Campus Daily" : "Your day at IITB — Campus Daily", html, text };
}
