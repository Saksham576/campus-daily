import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type FeedItem } from "@/components/ItemCard";
import { type Sponsored } from "@/components/SponsoredCard";
import { AppBar } from "@/components/AppBar";
import { DayBoard, type BoardRow } from "@/components/DayBoard";
import { FeedView } from "@/components/FeedView";
import { buildSections } from "@/lib/sections";
import { buildWeek, formatCourseCode, type UserCourse } from "@/lib/timetable/slots";
import { applyCourseUpdates, istDate, type CourseUpdate } from "@/lib/timetable/updates";

export const dynamic = "force-dynamic";

const MIN_SCORE = 4;
const IST = 5.5 * 3600_000;

/** Today's classes (or the next class day's) for the departure board. */
function boardFor(courses: UserCourse[], updates: CourseUpdate[], now: Date): { title: string; rows: BoardRow[] } {
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(now.getTime() + offset * 86400_000);
    const date = istDate(day.toISOString());
    const week = applyCourseUpdates(
      buildWeek(courses, day).map((s) => ({ ...s, is_cancelled: false })),
      updates
    ).filter((s) => istDate(s.start_time) === date);
    const remaining = offset === 0 ? week.filter((s) => new Date(s.end_time || s.start_time).getTime() > now.getTime() - 2 * 3600_000) : week;
    if (week.length > 0 && (offset > 0 || remaining.length > 0)) {
      const label =
        offset === 0
          ? "Today"
          : offset === 1
          ? "Tomorrow"
          : new Date(day.getTime() + IST).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
      const rows = week.map((s) => {
        const [code, ...rest] = s.title.split(": ");
        return {
          id: s.id,
          start: s.start_time,
          end: s.end_time || s.start_time,
          code: formatCourseCode(code.replace(" (Tutorial)", "")) + (s.title.includes("(Tutorial)") ? " TUT" : ""),
          name: rest.join(": ").replace(" (Tutorial)", "") || s.slot_type,
          venue: s.location || "",
          cancelled: Boolean(s.is_cancelled),
          moved: Boolean(s.notice_id) && !s.is_cancelled,
        };
      });
      return { title: label, rows };
    }
  }
  return { title: "Today", rows: [] };
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("subscribers")
    .select("onboarded_at, name, last_seen_at, muted_senders")
    .eq("email", user.email)
    .single();
  if (!profile?.onboarded_at) redirect("/settings?onboarding=1");

  const now = new Date();
  // 21 days so deadlines and upcoming events announced earlier stay on the board.
  const since = new Date(now.getTime() - 21 * 86400_000).toISOString();
  const today = istDate(now.toISOString());

  const [feedRes, coursesRes, updatesRes, cardsRes] = await Promise.all([
    supabase.rpc("me_feed", { p_since: since, p_min_score: MIN_SCORE }),
    supabase.from("user_courses").select("course_code, title, division, lecture_slots, tutorial_slots, venue"),
    supabase.from("course_updates").select("*").gte("on_date", today).lte("on_date", istDate(new Date(now.getTime() + 8 * 86400_000).toISOString())),
    supabase.from("sponsored_cards").select("id, sponsor, title, body, link, ends_on").lte("starts_on", today).order("created_at", { ascending: false }).limit(5),
  ]);

  const muted = new Set<string>(profile?.muted_senders || []);
  const items = ((feedRes.data || []) as FeedItem[]).filter((i) => !i.from_address || !muted.has(i.from_address));

  // Your seat from seating plans (RLS: each student reads only their own roll's rows).
  if (items.length) {
    const { data: seats } = await supabase.from("seat_assignments").select("item_id, seat").in("item_id", items.map((i) => i.id));
    const seatBy = new Map((seats || []).map((r) => [r.item_id, r.seat]));
    for (const i of items) i.seat = seatBy.get(i.id) || null;
  }
  const courses = (coursesRes.data || []) as UserCourse[];
  const myCourses = new Set(courses.map((c) => formatCourseCode(c.course_code)));
  const sections = buildSections(items, myCourses, now);
  const board = boardFor(courses, (updatesRes.data || []) as CourseUpdate[], now);
  const sponsored = ((cardsRes.data || []) as (Sponsored & { ends_on: string | null })[]).find(
    (c) => !c.ends_on || c.ends_on >= today
  );

  // Inactivity tracking for the reminder email (at most one write per hour)
  if (!profile?.last_seen_at || now.getTime() - new Date(profile.last_seen_at).getTime() > 3600_000) {
    await supabase.from("subscribers").update({ last_seen_at: now.toISOString() }).eq("email", (user.email || "").toLowerCase());
  }

  const first = (profile?.name || "").split(" ")[0];
  const dateLine = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  return (
    <>
      <AppBar />
      <main className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">{dateLine}</p>
            <h1>{first ? `Morning, ${first}` : "Your board"}</h1>
          </div>
        </div>

        {feedRes.error && <p className="err">Could not load notices: {feedRes.error.message}</p>}

        <DayBoard
          title={board.title}
          rows={board.rows}
          emptyText={courses.length ? "No classes scheduled." : "Add your courses in Settings to see your classes here."}
        />
        {courses.length === 0 && (
          <p className="section-note">
            <Link href="/settings#courses">→ Add your courses</Link> to light up the board.
          </p>
        )}

        <FeedView sections={sections as any} sponsored={sponsored || null} />
      </main>
    </>
  );
}
