import { extractEventDetails } from "./events.ts";
import { majorKey } from "./majorEvents.ts";
import { parseDueDate } from "./sections.ts";
import { istDate } from "./timetable/updates.ts";

/**
 * Should this new notice buzz everyone's phone as a big event? Only for the institute's own big events
 * (Insti Nite, Mood Indigo, Techfest…), only with a written date, and only from 2 hours after it started to 3 days before.
 * `key` is the notification tag, so the mail, the Instagram post and the WhatsApp message about one event replace each other.
 */
export function majorAlert(subject: string, body: string | null | undefined, now = new Date()): { key: string; start: string } | null {
  const event = majorKey(subject);
  if (!event) return null;
  const text = `${subject}\n${(body || "").slice(0, 3000)}`;
  const written = parseDueDate(text, now);
  if (!written) return null;
  let start = written;
  try {
    const ev = extractEventDetails(subject, body || "");
    if (ev && istDate(ev.start_time) === istDate(written)) start = ev.start_time;
  } catch {}
  const t = new Date(start).getTime();
  if (Number.isNaN(t) || t < now.getTime() - 2 * 3600_000 || t > now.getTime() + 72 * 3600_000) return null;
  return { key: `major:${event}:${istDate(start)}`, start };
}
