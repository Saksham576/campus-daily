import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { parseIcs } from "@/lib/timetable/ics";

export type ImportKind = "event" | "lecture" | "lab" | "custom";
export type ImportResult = { ok: true; imported: number; skipped: number; removed: number } | { ok: false; error: string };

const DAY = 86400000;
// Only well-known calendar hosts: the server fetches this address, so it must never be an arbitrary URL.
const HOSTS = [/^calendar\.google\.com$/, /^outlook\.live\.com$/, /^outlook\.office365\.com$/, /^outlook\.office\.com$/, /^p\d+-caldav\.icloud\.com$/, /^[a-z0-9-]+\.icloud\.com$/];
const MAX_BYTES = 5_000_000;

/** Turn what students paste (webcal://…, https://calendar.google.com/…/basic.ics) into a safe https URL, or explain why not. */
export function checkCalendarUrl(raw: string): { url: string } | { error: string } {
  let s = raw.trim();
  if (!s) return { error: "Paste the calendar address first." };
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:\/\//i, "https://");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { error: "That doesn't look like a web address." };
  }
  if (u.protocol !== "https:") return { error: "The address must start with https://." };
  if (!HOSTS.some((h) => h.test(u.hostname))) return { error: "Only Google Calendar, Outlook and iCloud calendar addresses can be imported. For others, upload the .ics file." };
  if (u.hostname === "calendar.google.com" && !/\.ics$/i.test(u.pathname)) {
    return { error: "Use the 'Secret address in iCal format' (it ends in .ics), not the public link. Settings → your calendar → Integrate calendar." };
  }
  return { url: u.toString() };
}

async function download(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { accept: "text/calendar, */*" } });
    if (!res.ok) throw new Error(res.status === 404 || res.status === 403 ? "That address no longer works. Copy the secret address again (it changes if you reset it)." : `The calendar answered with an error (${res.status}).`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("That calendar is too big to import.");
    const text = new TextDecoder().decode(buf);
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That address didn't return a calendar.");
    return text;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("The calendar took too long to answer. Try again.");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Replace this student's imported events (from today back one week onward) with what the calendar says now.
 * Their own slots and course classes are never touched; an event already in the timetable is not added twice.
 */
export async function importCalendar(
  supabase: SupabaseClient,
  userId: string,
  src: { url?: string; ics?: string; kind?: ImportKind },
  now = new Date()
): Promise<ImportResult> {
  try {
    const text = src.ics ?? (await download(src.url!));
    const from = new Date(now.getTime() - 7 * DAY);
    const to = new Date(now.getTime() + 150 * DAY);
    const { events, skipped } = parseIcs(text, { from, to, max: 600 });
    const kind: ImportKind = src.kind || "event";

    const fromIso = from.toISOString();
    const { count: removed } = await supabase.from("user_schedules").delete({ count: "exact" }).eq("user_id", userId).eq("origin", "gcal").gte("start_time", fromIso);

    // Skip anything already in the timetable at the same time with the same title (e.g. a class you also keep in Google Calendar).
    const { data: have } = await supabase.from("user_schedules").select("title, start_time").eq("user_id", userId).gte("start_time", fromIso);
    const seen = new Set((have || []).map((r) => `${String(r.title).toLowerCase()}|${new Date(r.start_time).getTime()}`));
    const series = new Map<string, string>();
    const rows = events
      .filter((e) => !seen.has(`${e.title.toLowerCase()}|${new Date(e.start).getTime()}`))
      .map((e) => {
        if (!series.has(e.uid)) series.set(e.uid, randomUUID());
        return {
          user_id: userId,
          title: e.title.slice(0, 200),
          location: e.location?.slice(0, 200) || null,
          start_time: e.start,
          end_time: e.end,
          slot_type: kind,
          is_cancelled: false,
          origin: "gcal",
          series_id: series.get(e.uid),
        };
      });
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("user_schedules").insert(rows.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
    if (src.url) {
      await supabase.from("calendar_feeds").upsert({ user_id: userId, url: src.url, slot_type: kind, last_sync_at: now.toISOString(), last_count: rows.length, last_error: null }, { onConflict: "user_id" });
    }
    return { ok: true, imported: rows.length, skipped: skipped + (events.length - rows.length), removed: removed || 0 };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Couldn't import that calendar.";
    if (src.url) await supabase.from("calendar_feeds").update({ last_error: error }).eq("user_id", userId);
    return { ok: false, error };
  }
}
