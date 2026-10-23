/**
 * Cross-source event linking: the same quiz / class change / event often arrives by Moodle, email and
 * WhatsApp. Each notice becomes a Claim; claims about the same thing join one Event; the Event's
 * details are resolved by trust (instructor/Moodle > official email > WhatsApp), newest first on ties.
 */
import { extractEventDetails } from "./events.ts";
import { parseDueDate } from "./sections.ts";
import { updateFromNotice, istDate, type CourseUpdate } from "./timetable/updates.ts";

export type LinkItem = {
  id: string;
  subject: string;
  body?: string | null;
  summary?: string | null;
  source?: string | null;
  sender?: string | null;
  from_address?: string | null;
  received_at?: string | null;
  is_verified?: boolean | null;
};

export type ClaimKind = "assessment" | "class" | "event";

export type Claim = {
  item_id: string;
  source: string;
  trust: number; // 3 instructor/Moodle · 2 official email · 1 WhatsApp
  at: string; // when this source said it
  course_code: string | null;
  kind: ClaimKind;
  on_date: string; // IST YYYY-MM-DD
  start: string | null;
  end: string | null;
  venue: string | null;
  cancelled: boolean;
  /** Last day of a multi-day cancellation (a buffer week). */
  until?: string | null;
  title: string;
  tokens: string[];
};

export type Resolved = {
  title: string;
  start: string | null;
  end: string | null;
  venue: string | null;
  cancelled: boolean;
  until?: string | null;
  /** Field → the claim that decided it. */
  decidedBy: Partial<Record<"start" | "venue" | "cancelled", { item_id: string; source: string; at: string }>>;
  /** Other values sources reported for the same field (shown as "WhatsApp said LH 101"). */
  conflicts: { field: "start" | "venue"; value: string; source: string; at: string; item_id: string }[];
  sources: { item_id: string; source: string; at: string }[];
};

const POSTED_LINE_RE =
  /\bby\s[^\n]{0,80}?\s[-–]\s(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s+\d{1,2}\s+[a-z]+\s+\d{4},?\s+\d{1,2}:\d{2}\s*(?:am|pm)?/gi;
const EVENTY_RE = /\b(quiz|exam|test|viva|lab|lecture|class|tutorial|session|workshop|talk|seminar|orientation|meet|competition|match|screening|fest|night|deadline)\b/i;
const STOP = new Set(
  "the and for with from your you are this that will have has all its our out not but can now new on in at to of a an is be by or as it re fwd fw subject dear students reminder invitation registrations registration open update updated today tomorrow tonight please join us"
    .split(" ")
);
const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$/;
const DAYS = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*$/;

/** Where a notice came from, as a short label. */
export function sourceKind(item: LinkItem): "moodle" | "email" | "whatsapp" | "bodhitree" {
  const from = `${item.sender || item.from_address || ""}`;
  if (item.source === "whatsapp" || from.startsWith("WhatsApp:")) return "whatsapp";
  if (item.source === "moodle" || /moodle/i.test(from)) return "moodle";
  if (/bodhitree/i.test(from) || /\[bodhitree\]/i.test(item.subject)) return "bodhitree";
  return "email";
}

export function trustOf(item: LinkItem): number {
  const k = sourceKind(item);
  if (item.is_verified || k === "moodle" || k === "bodhitree") return 3;
  if (k === "email") return 2;
  return 1;
}

/** Distinctive words of a title (no dates, stop words or list tags). */
export function titleTokens(title: string): string[] {
  const t = title
    .replace(/^\s*(\[[^\]]{1,60}\]\s*)+/, "")
    .replace(/[A-Z]{2,4}\s?\d{3}[A-Z]?-\d{4}-\d(?:-[A-Z0-9]+)?:?/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ");
  const out = new Set<string>();
  for (const w of t.split(/\s+/)) {
    if (w.length < 3 && !/^\d+$/.test(w)) continue;
    if (STOP.has(w) || MONTHS.test(w) || DAYS.test(w) || /^\d{1,2}(st|nd|rd|th)$/.test(w) || /^20\d\d$/.test(w)) continue;
    out.add(w);
  }
  return [...out];
}

export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  const inter = a.filter((x) => B.has(x)).length;
  return inter / (a.length + b.length - inter);
}

/** What this notice says about a dated, upcoming thing — or null if it isn't about one. */
export function claimFrom(item: LinkItem, now = new Date()): Claim | null {
  const body = (item.body || item.summary || "").replace(POSTED_LINE_RE, " ");
  const at = item.received_at || now.toISOString();
  const base = { item_id: item.id, source: sourceKind(item), trust: trustOf(item), at, title: item.subject, tokens: titleTokens(item.subject) };

  // New-file announcements and students' doubt-forum posts aren't events.
  if (/:\s*(New file|Seating plan) —/.test(item.subject) || /->\s*Doubt Forum\s*->/i.test(body)) return null;

  // Course notices: reuse the timetable rules (cancel / move / quiz-exam-deadline).
  const u = updateFromNotice(item.subject, body, item.id, new Date(at));
  // Division-specific changes and "no more lectures" are applied straight from their notice, not merged across sources.
  if (u && (u.division || u.slot_type === "session" || u.slot_type === "lecture")) return null;
  if (u) {
    return {
      ...base,
      course_code: u.course_code,
      kind: u.kind === "added" ? "assessment" : "class",
      on_date: u.on_date,
      start: u.new_start || u.match_start || null,
      end: u.new_end || null,
      venue: u.new_location || null,
      cancelled: u.kind === "cancelled",
      until: u.until_date || null,
    };
  }

  // Other dated things (talks, fests, deadlines…): only with a date actually written in the notice.
  const text = `${item.subject}\n${body}`;
  const written = parseDueDate(text, now) || (/\b(today|tonight|tomorrow)\b/i.test(text) ? at : null);
  if (!written || !EVENTY_RE.test(text)) return null;
  let ev = null;
  try {
    ev = extractEventDetails(item.subject, body);
  } catch {}
  const start = ev?.start_time || written;
  const on_date = istDate(start);
  if (on_date < istDate(at)) return null; // about the past
  return {
    ...base,
    // Only the strict course rules above may name a course (and so change a timetable): the general
    // parser reads room names like "LA 001" as course codes.
    course_code: null,
    kind: "event",
    on_date,
    start: ev?.start_time || null,
    end: ev?.end_time || null,
    venue: ev?.location || null,
    cancelled: Boolean(ev?.is_cancelled),
  };
}

export type EventLike = { course_code: string | null; kind: ClaimKind; on_date: string; tokens: string[] };

/**
 * "yes" when claim and event are surely the same thing, "maybe" when an AI check should decide, "no" otherwise.
 * Course claims match on course + day + kind; others on day + similar titles.
 */
export function matchScore(c: Claim, e: EventLike): "yes" | "maybe" | "no" {
  if (c.on_date !== e.on_date) return "no";
  if (c.course_code && e.course_code) {
    if (c.course_code !== e.course_code) return "no";
    if (c.kind === e.kind) return "yes";
    return "no"; // a quiz and a lecture on the same day are different things
  }
  if (c.course_code || e.course_code) {
    // One side names the course, the other doesn't (e.g. a WhatsApp "quiz shifted to LH 101").
    return jaccard(c.tokens, e.tokens) >= 0.25 ? "maybe" : "no";
  }
  const j = jaccard(c.tokens, e.tokens);
  if (j >= 0.5) return "yes";
  if (j >= 0.25) return "maybe";
  return "no";
}

const rank = (a: Claim, b: Claim) => b.trust - a.trust || Date.parse(b.at) - Date.parse(a.at);

/** Settle an event's details from all its claims. */
export function resolveClaims(claims: Claim[]): Resolved {
  const sorted = [...claims].sort(rank);
  const pick = <K extends "start" | "venue">(field: K) => sorted.find((c) => c[field]);
  const startBy = pick("start");
  const venueBy = pick("venue");
  // A cancellation from any source at least as trusted as the newest non-cancel claim wins.
  const cancelBy = sorted.find((c) => c.cancelled);
  const newestLive = sorted.filter((c) => !c.cancelled).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  const cancelled = Boolean(cancelBy && (!newestLive || cancelBy.trust >= newestLive.trust || Date.parse(cancelBy.at) > Date.parse(newestLive.at)));

  const conflicts: Resolved["conflicts"] = [];
  for (const c of sorted) {
    if (venueBy && c.venue && norm(c.venue) !== norm(venueBy.venue!) && c !== venueBy)
      conflicts.push({ field: "venue", value: c.venue, source: c.source, at: c.at, item_id: c.item_id });
    if (startBy && c.start && c.start !== startBy.start && c !== startBy)
      conflicts.push({ field: "start", value: c.start, source: c.source, at: c.at, item_id: c.item_id });
  }
  const who = (c?: Claim) => (c ? { item_id: c.item_id, source: c.source, at: c.at } : undefined);
  return {
    title: sorted[0]?.title || "",
    start: startBy?.start || null,
    end: startBy?.end || null,
    venue: venueBy?.venue || null,
    cancelled,
    until: cancelled ? cancelBy?.until || null : null,
    decidedBy: { start: who(startBy), venue: who(venueBy), cancelled: cancelled ? who(cancelBy) : undefined },
    conflicts,
    sources: sorted.map((c) => ({ item_id: c.item_id, source: c.source, at: c.at })),
  };
}

const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * One timetable change for the whole event (replaces per-notice changes). It hangs off the event's
 * most trusted notice (course_updates.notice_id must be a real notice).
 */
export function eventCourseUpdate(primaryNoticeId: string, e: { course_code: string | null; kind: ClaimKind; on_date: string }, r: Resolved, verified: boolean): CourseUpdate | null {
  if (!e.course_code || !primaryNoticeId) return null;
  const notice_id = primaryNoticeId;
  if (e.kind === "assessment") {
    if (!r.start) return null;
    return { course_code: e.course_code, kind: "added", on_date: e.on_date, new_start: r.start, new_end: r.end, new_location: r.venue, slot_type: "quiz", title: r.title, notice_id, verified };
  }
  if (r.cancelled) return { course_code: e.course_code, kind: "cancelled", on_date: e.on_date, until_date: r.until || null, match_start: r.start, notice_id, verified };
  if (r.venue || r.start) return { course_code: e.course_code, kind: "moved", on_date: e.on_date, new_location: r.venue, new_start: r.start, new_end: r.end, notice_id, verified };
  return null;
}

export type Linked = {
  eventId: string;
  /** Every source that reported this event, most trusted first. */
  sources: { source: string; at: string; item_id: string }[];
  start: string | null;
  venue: string | null;
  cancelled: boolean;
  conflicts: Resolved["conflicts"];
};

/**
 * Collapse notices about the same event into one card: the most trusted (then newest) notice stays,
 * carrying `linked` with every source and the settled details. Unlinked notices pass through.
 */
export function groupByEvent<T extends LinkItem & { status?: string | null }>(
  items: T[],
  links: { item_id: string; event_id: string }[],
  events: { id: string; resolved: Partial<Resolved> | null }[]
): (T & { linked?: Linked })[] {
  const eventOf = new Map(links.map((l) => [l.item_id, l.event_id]));
  const byEvent = new Map<string, T[]>();
  for (const it of items) {
    const e = eventOf.get(it.id);
    if (e) byEvent.set(e, [...(byEvent.get(e) || []), it]);
  }
  const resolvedOf = new Map(events.map((e) => [e.id, e.resolved || {}]));
  const keep = new Map<string, T & { linked?: Linked }>();
  for (const [eid, group] of byEvent) {
    const best = [...group].sort((a, b) => trustOf(b) - trustOf(a) || Date.parse(b.received_at || "") - Date.parse(a.received_at || ""))[0];
    const r = resolvedOf.get(eid) || {};
    const kept = group.find((g) => g.status === "kept");
    keep.set(best.id, {
      ...best,
      status: kept ? "kept" : best.status,
      linked: {
        eventId: eid,
        sources: (r.sources?.length ? r.sources : group.map((g) => ({ item_id: g.id, source: sourceKind(g), at: g.received_at || "" }))) as Linked["sources"],
        start: r.start ?? null,
        venue: r.venue ?? null,
        cancelled: Boolean(r.cancelled),
        conflicts: r.conflicts || [],
      },
    });
  }
  const out: (T & { linked?: Linked })[] = [];
  for (const it of items) {
    const e = eventOf.get(it.id);
    if (!e) out.push(it);
    else if (keep.has(it.id)) out.push(keep.get(it.id)!);
  }
  return out;
}
