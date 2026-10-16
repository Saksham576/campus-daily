import type { TodayClass } from "./reminder.ts";

export type DigestDue = { title: string; due_at: string; kind?: string | null };

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** One short push: today's classes, what's due this week, the next exam. */
export function digestPush(classes: TodayClass[], due: DigestDue[], exams: DigestDue[]): { title: string; body: string } | null {
  const live = classes.filter((c) => c.note !== "Cancelled");
  const changed = classes.filter((c) => c.note);
  const parts: string[] = [];
  if (live.length) parts.push(`${live.length} class${live.length > 1 ? "es" : ""} from ${live[0].time}`);
  if (changed.length) parts.push(changed.map((c) => `${c.course} ${c.note!.toLowerCase()}`).join(", "));
  if (due.length) parts.push(`${due.length} due this week (next: ${due[0].title}, ${day(due[0].due_at)})`);
  if (exams.length) parts.push(`${exams[0].title} on ${day(exams[0].due_at)}`);
  if (!parts.length) return null; // nothing worth a buzz
  const title = changed.length ? "Timetable changed today" : live.length ? "Your day" : "This week";
  return { title, body: parts.join(" · ") };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function digestEmail(
  name: string | null | undefined,
  classes: TodayClass[],
  due: DigestDue[],
  exams: DigestDue[],
  appUrl = "https://campusdaily.nexuspulsetech.com"
): { subject: string; html: string; text: string } {
  const first = (name || "").split(" ")[0] || "there";
  const cls = classes.length
    ? classes
        .map((c) => `<tr><td style="padding:4px 10px 4px 0;color:#666">${esc(c.time)}</td><td style="padding:4px 10px 4px 0"><b>${esc(c.course)}</b> ${esc(c.title)}</td><td style="padding:4px 10px 4px 0;color:#666">${esc(c.location)}</td><td style="color:#C8321F">${esc(c.note || "")}</td></tr>`)
        .join("")
    : `<tr><td>No classes today.</td></tr>`;
  const list = (xs: DigestDue[]) => xs.map((d) => `<li><b>${esc(d.title)}</b> — ${esc(day(d.due_at))}</li>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#17171a">
<p>Good morning ${esc(first)} — here's your day.</p>
<h3 style="margin:16px 0 6px">Today</h3><table style="border-collapse:collapse;font-size:14px">${cls}</table>
${due.length ? `<h3 style="margin:16px 0 6px">Due this week</h3><ul style="font-size:14px;padding-left:18px">${list(due)}</ul>` : ""}
${exams.length ? `<h3 style="margin:16px 0 6px">Exams coming up</h3><ul style="font-size:14px;padding-left:18px">${list(exams)}</ul>` : ""}
<p style="margin-top:18px"><a href="${appUrl}">Open Campus Daily</a> · <a href="${appUrl}/settings#alerts" style="color:#666">Change or stop this email</a></p></div>`;
  const text = `Good morning ${first}.\n\nToday:\n${classes.map((c) => `${c.time} ${c.course} ${c.title} @ ${c.location}${c.note ? ` (${c.note})` : ""}`).join("\n") || "No classes."}\n${due.length ? `\nDue this week:\n${due.map((d) => `- ${d.title} (${day(d.due_at)})`).join("\n")}\n` : ""}${exams.length ? `\nExams:\n${exams.map((d) => `- ${d.title} (${day(d.due_at)})`).join("\n")}\n` : ""}\n${appUrl}`;
  return { subject: classes.some((c) => c.note) ? "Your timetable changed today" : "Your day at IITB", html, text };
}
