import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ScheduleClient, { type ScheduleItem } from "@/components/ScheduleClient";
import { importCalendar, type ImportKind } from "@/lib/server/calendarImport";
import { WEEKS_AHEAD, WEEKS_BACK, addDays, buildRange, mondayOf } from "@/lib/timetable/range";
import type { UserCourse } from "@/lib/timetable/slots";
import type { CourseUpdate } from "@/lib/timetable/updates";

export const dynamic = "force-dynamic";

/** Timetable: about a month of classes (a week back, five weeks ahead), fetched in one parallel round trip. */
export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const from = addDays(mondayOf(now), -7 * WEEKS_BACK);
  const to = addDays(mondayOf(now), 7 * (WEEKS_AHEAD + 1) - 1);

  const [coursesRes, updatesRes, savedRes, moodleRes, feedRes] = await Promise.all([
    supabase.from("user_courses").select("course_code, title, division, lecture_slots, tutorial_slots, venue"),
    supabase.from("course_updates").select("*").gte("until_date", from).lte("on_date", to).order("created_at", { ascending: true }),
    supabase.from("user_schedules").select("*").gte("start_time", `${from}T00:00:00+05:30`).lte("start_time", `${to}T23:59:59+05:30`).order("start_time", { ascending: true }),
    supabase.from("moodle_connections").select("user_id", { count: "exact", head: true }),
    supabase.from("calendar_feeds").select("url, slot_type, last_sync_at, last_count, last_error").eq("user_id", user.id).maybeSingle(),
  ]);

  // A connected calendar refreshes itself: if it is over six hours old, update it after this page is sent.
  const feed = feedRes.data;
  if (feed && (!feed.last_sync_at || now.getTime() - new Date(feed.last_sync_at).getTime() > 6 * 3600_000)) {
    after(async () => {
      await importCalendar(supabase, user.id, { url: feed.url, kind: feed.slot_type as ImportKind });
    });
  }

  const slots = buildRange(
    (coursesRes.data || []) as UserCourse[],
    (updatesRes.data || []) as CourseUpdate[],
    (savedRes.data || []) as any[],
    now
  ) as unknown as ScheduleItem[];

  return <ScheduleClient initialSchedules={slots.map((s) => ({ ...s, user_id: user.id }))} moodleOn={!!moodleRes.count} feed={feed ? { host: new URL(feed.url).hostname, last_sync_at: feed.last_sync_at, last_count: feed.last_count, last_error: feed.last_error, slot_type: feed.slot_type } : null} />;
}
