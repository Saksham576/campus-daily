/**
 * The institute's own big events (Insti Nite, Mood Indigo, Techfest, convocation, institute lectures…).
 * Everyone should hear about these whatever they follow, so they rise on Home, appear in a "On campus" card
 * while they are close, and may buzz phones. Auditions, trials and registrations *for* them are not the event.
 */

/** [key, pattern]. The first matching pattern names the event, so mail and Instagram posts about it share a key. */
const MAJOR: [string, RegExp][] = [
  ["instinite", /\binsti[\s-]?ni(?:te|ght)\b/i],
  ["moodindigo", /\bmood[\s-]?indigo\b/i],
  ["techfest", /\btechfest\b/i],
  ["interiitmeet", /\binter[\s-]?iit (?:cult(?:ural)?|tech|sports)? ?meet\b/i],
  ["convocation", /\bconvocation\b/i],
  ["institutelecture", /\b(?:distinguished|institute) (?:institute )?lecture\b|\bmemorial lecture\b/i],
  ["foundationday", /\b(?:foundation|institute|annual) day\b|\bindependence day\b|\brepublic day\b/i],
  ["esummit", /\be-?summit\b/i],
  ["sportsmeet", /\bannual sports meet\b|\binstitute (?:sports|cultural) (?:meet|night)\b|\bprize (?:distribution|night|ceremony)\b/i],
  ["holiday", /\binstitute holiday\b/i],
];

/** Auditions, trials, signing up and merchandise are about the event, not the event. */
const NOT_THE_EVENT = /\b(audition|auditions|trials?|selection|contingent|registrations?|recruitment|applications?|merch)\b/i;

/** Which big event this subject is about, or null. */
export function majorKey(subject: string): string | null {
  if (!subject || NOT_THE_EVENT.test(subject)) return null;
  for (const [key, re] of MAJOR) if (re.test(subject)) return key;
  return null;
}

export const isMajorEvent = (subject: string) => majorKey(subject) !== null;

const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

/**
 * Big events happening now or soon, one per event even when mail, Instagram and WhatsApp all announce it.
 * `when` is the event's start (set by the sections builder); started events stay for 3 hours.
 */
export function bigEventsSoon<T extends { id: string; subject: string; when?: string | null }>(items: T[], now: Date, aheadHours = 36): T[] {
  const lo = now.getTime() - 3 * 3600_000;
  const hi = now.getTime() + aheadHours * 3600_000;
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (!it.when) continue;
    const key = majorKey(it.subject);
    const t = new Date(it.when).getTime();
    if (!key || !(t >= lo && t <= hi)) continue;
    const id = `${key}:${istDay(it.when)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out.sort((a, b) => new Date(a.when as string).getTime() - new Date(b.when as string).getTime());
}

/** "Tonight 5:00 pm", "Tomorrow 7:00 pm", "On now", "Sun 1 Nov, 6:00 pm". */
export function whenLabel(iso: string, now: Date): string {
  const t = new Date(iso);
  const time = t.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).toLowerCase();
  if (t.getTime() <= now.getTime()) return "On now";
  const days = Math.round((Date.parse(istDay(iso)) - Date.parse(istDay(now.toISOString()))) / 86400_000);
  const hourIST = Number(t.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }));
  if (days <= 0) return `${hourIST >= 17 ? "Tonight" : "Today"} ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  return `${t.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}, ${time}`;
}
