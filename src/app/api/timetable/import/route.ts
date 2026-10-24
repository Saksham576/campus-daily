import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkCalendarUrl, importCalendar, type ImportKind } from "@/lib/server/calendarImport";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KINDS = ["event", "lecture", "lab", "custom"];

/** Bring a Google / Outlook / iCloud calendar (secret address or an uploaded .ics) into your timetable. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { url?: string; ics?: string; kind?: string; sync?: boolean };
  const kind = (KINDS.includes(String(body.kind)) ? body.kind : "event") as ImportKind;

  if (body.sync) {
    const { data: feed } = await supabase.from("calendar_feeds").select("url, slot_type").eq("user_id", user.id).maybeSingle();
    if (!feed) return NextResponse.json({ error: "No calendar is connected yet." }, { status: 400 });
    const r = await importCalendar(supabase, user.id, { url: feed.url, kind: feed.slot_type as ImportKind });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (typeof body.ics === "string" && body.ics.length) {
    if (body.ics.length > 5_000_000) return NextResponse.json({ error: "That file is too big." }, { status: 413 });
    if (!/BEGIN:VCALENDAR/i.test(body.ics)) return NextResponse.json({ error: "That isn't a calendar (.ics) file." }, { status: 400 });
    const r = await importCalendar(supabase, user.id, { ics: body.ics, kind });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  const checked = checkCalendarUrl(String(body.url || ""));
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const r = await importCalendar(supabase, user.id, { url: checked.url, kind });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

/** Disconnect: forget the address and remove everything it brought in. */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  await supabase.from("calendar_feeds").delete().eq("user_id", user.id);
  const { count } = await supabase.from("user_schedules").delete({ count: "exact" }).eq("user_id", user.id).eq("origin", "gcal");
  return NextResponse.json({ ok: true, removed: count || 0 });
}
