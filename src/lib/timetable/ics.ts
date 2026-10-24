/**
 * Read a calendar file (.ics) exported from Google Calendar, Outlook or Apple Calendar and list its
 * events inside a window, with repeating events (RRULE) spelled out one by one.
 * Handles: folded lines, TZID / UTC / floating times, WEEKLY / DAILY / MONTHLY / YEARLY repeats with
 * INTERVAL, BYDAY, COUNT and UNTIL, EXDATE, and edited or cancelled single occurrences (RECURRENCE-ID).
 */

export type IcsEvent = { uid: string; title: string; location: string | null; start: string; end: string };

type Prop = { name: string; params: Record<string, string>; value: string };

const DAY = 86400000;
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out.filter(Boolean);
}

function parseLine(line: string): Prop | null {
  const colon = (() => {
    let q = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') q = !q;
      else if (line[i] === ":" && !q) return i;
    }
    return -1;
  })();
  if (colon < 0) return null;
  const head = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of head.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: head[0].toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescapeText = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

/** Offset (ms) of a time zone at an instant, from Intl. */
function zoneOffset(ms: number, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(ms / 1000) * 1000;
  } catch {
    return 5.5 * 3600_000;
  }
}

/** Wall-clock time in a zone -> instant (ms). */
function wallToInstant(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let ms = guess - zoneOffset(guess, tz);
  ms = guess - zoneOffset(ms, tz);
  return ms;
}

type When = { ms: number; tz: string; allDay: boolean; wall: [number, number, number, number, number, number] };

function parseWhen(p: Prop | undefined): When | null {
  if (!p) return null;
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const allDay = m[4] === undefined || p.params["VALUE"] === "DATE";
  const [h, mi, s] = [Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)];
  // Floating times and unknown zones are read as IST (the calendar of an IIT Bombay student).
  const tz = m[7] ? "UTC" : p.params["TZID"] || "Asia/Kolkata";
  return { ms: wallToInstant(y, mo, d, h, mi, s, tz), tz, allDay, wall: [y, mo, d, h, mi, s] };
}

const parseRrule = (v: string) => {
  const o: Record<string, string> = {};
  for (const part of v.split(";")) {
    const [k, val] = part.split("=");
    if (k && val) o[k.toUpperCase()] = val;
  }
  return o;
};

/** Occurrence start times (ms) of a repeating event inside [from, to]. */
function occurrences(start: When, rule: Record<string, string>, exdates: Set<number>, from: number, to: number, cap = 800): number[] {
  const out: number[] = [];
  const freq = rule.FREQ;
  const interval = Math.max(1, Number(rule.INTERVAL || 1));
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity;
  const until = rule.UNTIL ? parseWhen({ name: "UNTIL", params: {}, value: rule.UNTIL })?.ms ?? Infinity : Infinity;
  const [y, mo, d, h, mi, s] = start.wall;
  const at = (yy: number, mm: number, dd: number) => wallToInstant(yy, mm, dd, h, mi, s, start.tz);
  let n = 0;
  const push = (ms: number) => {
    if (ms < start.ms || ms > until) return false;
    n++;
    if (n > count) return false;
    if (ms >= from && ms <= to && !exdates.has(ms)) out.push(ms);
    return out.length < cap;
  };

  const hardStop = Math.min(to, until);
  if (freq === "DAILY") {
    for (let i = 0; ; i += interval) {
      const ms = at(y, mo, d + i);
      if (ms > hardStop) break;
      if (!push(ms)) break;
    }
  } else if (freq === "WEEKLY") {
    const days = (rule.BYDAY ? rule.BYDAY.split(",").map((x) => BYDAY.indexOf(x.replace(/^[+-]?\d*/, ""))) : [new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]).filter((x) => x >= 0).sort((a, b) => a - b);
    const startDow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    const weekStart = d - ((startDow + 6) % 7); // Monday of the first week
    for (let w = 0; ; w += interval) {
      let any = false;
      for (const dow of days) {
        const ms = at(y, mo, weekStart + w * 7 + ((dow + 6) % 7));
        if (ms > hardStop) continue;
        any = true;
        if (ms < start.ms) continue;
        if (!push(ms)) return out;
      }
      if (!any && at(y, mo, weekStart + w * 7) > hardStop) break;
    }
  } else if (freq === "MONTHLY") {
    for (let i = 0; ; i += interval) {
      const ms = at(y, mo + i, d);
      if (ms > hardStop) break;
      if (new Date(ms + (zoneOffset(ms, start.tz))).getUTCDate() !== d) continue; // no 31st in this month
      if (!push(ms)) break;
    }
  } else if (freq === "YEARLY") {
    for (let i = 0; ; i += interval) {
      const ms = at(y + i, mo, d);
      if (ms > hardStop) break;
      if (!push(ms)) break;
    }
  } else {
    push(start.ms);
  }
  return out;
}

export function parseIcs(text: string, opts: { from: Date; to: Date; max?: number }): { events: IcsEvent[]; skipped: number } {
  const from = opts.from.getTime();
  const to = opts.to.getTime();
  const max = opts.max ?? 600;
  const lines = unfold(text);

  type Raw = { props: Prop[] };
  const raws: Raw[] = [];
  let cur: Raw | null = null;
  for (const l of lines) {
    if (/^BEGIN:VEVENT/i.test(l)) cur = { props: [] };
    else if (/^END:VEVENT/i.test(l)) {
      if (cur) raws.push(cur);
      cur = null;
    } else if (cur) {
      const p = parseLine(l);
      if (p) cur.props.push(p);
    }
  }

  const events: IcsEvent[] = [];
  let skipped = 0;
  const overridden = new Set<string>(); // uid|original start
  const masters: { uid: string; title: string; location: string | null; start: When; durMs: number; rule: Record<string, string> | null; ex: Set<number> }[] = [];

  for (const r of raws) {
    const get = (n: string) => r.props.find((p) => p.name === n);
    const uid = get("UID")?.value || String(Math.random());
    const status = get("STATUS")?.value.toUpperCase();
    const start = parseWhen(get("DTSTART"));
    if (!start || start.allDay) {
      skipped++;
      continue;
    }
    const endW = parseWhen(get("DTEND"));
    const dur = get("DURATION")?.value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
    const durMs = endW ? Math.max(0, endW.ms - start.ms) : dur ? ((Number(dur[1] || 0) * 24 + Number(dur[2] || 0)) * 60 + Number(dur[3] || 0)) * 60_000 : 3600_000;
    const title = unescapeText(get("SUMMARY")?.value || "") || "Event";
    const location = unescapeText(get("LOCATION")?.value || "") || null;
    const recId = parseWhen(get("RECURRENCE-ID"));
    if (recId) {
      overridden.add(`${uid}|${recId.ms}`);
      if (status !== "CANCELLED" && start.ms >= from && start.ms <= to) events.push({ uid, title, location, start: new Date(start.ms).toISOString(), end: new Date(start.ms + durMs).toISOString() });
      continue;
    }
    if (status === "CANCELLED") continue;
    const ex = new Set<number>();
    for (const p of r.props.filter((x) => x.name === "EXDATE"))
      for (const v of p.value.split(",")) {
        const w = parseWhen({ ...p, value: v });
        if (w) ex.add(w.ms);
      }
    const rr = get("RRULE");
    masters.push({ uid, title, location, start, durMs, rule: rr ? parseRrule(rr.value) : null, ex });
  }

  for (const m of masters) {
    const starts = m.rule ? occurrences(m.start, m.rule, m.ex, from, to) : m.start.ms >= from && m.start.ms <= to && !m.ex.has(m.start.ms) ? [m.start.ms] : [];
    for (const ms of starts) {
      if (overridden.has(`${m.uid}|${ms}`)) continue;
      events.push({ uid: m.uid, title: m.title, location: m.location, start: new Date(ms).toISOString(), end: new Date(ms + m.durMs).toISOString() });
    }
  }
  events.sort((a, b) => a.start.localeCompare(b.start));
  if (events.length > max) {
    skipped += events.length - max;
    events.length = max;
  }
  return { events, skipped };
}

/** The dates (IST, YYYY-MM-DD) of a weekly repeat: chosen weekdays (0 = Sunday) from `fromDay` to `untilDay`. */
export function weeklyDates(fromDay: string, untilDay: string, weekdays: number[], cap = 400): string[] {
  const out: string[] = [];
  const end = Date.parse(untilDay + "T00:00:00Z");
  for (let t = Date.parse(fromDay + "T00:00:00Z"); t <= end && out.length < cap; t += DAY) {
    if (weekdays.includes(new Date(t).getUTCDay())) out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
