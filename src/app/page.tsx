import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type FeedItem } from "@/components/ItemCard";
import { type Sponsored } from "@/components/SponsoredCard";
import { AppBar } from "@/components/AppBar";
import { DayBoard, type BoardRow } from "@/components/DayBoard";
import { FeedView } from "@/components/FeedView";
import { HomeHead } from "@/components/HomeHead";
import { AskBox } from "@/components/AskBox";
import { buildSections } from "@/lib/sections";
import { coursesForDivision } from "@/lib/timetable/catalog";
import { groupByEvent } from "@/lib/linking";
import { buildWeek, formatCourseCode, type UserCourse } from "@/lib/timetable/slots";
import { applyCourseUpdates, istDate, withPersonalOverrides, type CourseUpdate } from "@/lib/timetable/updates";

export const dynamic = "force-dynamic";

const MIN_SCORE = 4;
const IST = 5.5 * 3600_000;

/** Today's classes (or the next class day's) for the departure board. */
function boardFor(courses: UserCourse[], updates: CourseUpdate[], saved: any[], now: Date): { title: string; rows: BoardRow[] } {
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(now.getTime() + offset * 86400_000);
    const date = istDate(day.toISOString());
    const week = withPersonalOverrides(
      applyCourseUpdates(
        buildWeek(courses, day).map((s) => ({ ...s, is_cancelled: false })),
        updates
      ),
      saved
    ).filter((s) => istDate(s.start_time) === date);
    const remaining = offset === 0 ? week.filter((s) => new Date(s.end_time || s.start_time).getTime() > now.getTime() - 15 * 60_000) : week;
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

type MoodleDue = { event_id: number; course_code: string | null; name: string; kind: string | null; due_at: string; url: string | null };

/** Your own Moodle deadlines: quizzes join Exams, everything else Action needed, soonest first. */
function addMoodleDeadlines(sections: Record<string, any[]>, rows: MoodleDue[]) {
  const t = (x: any) => (x.when ? new Date(x.when).getTime() : Infinity);
  for (const r of rows) {
    const quiz = r.kind === "quiz";
    const item = {
      id: `moodle-due-${r.event_id}`,
      subject: `${r.course_code ? r.course_code + ": " : ""}${r.name}`,
      summary: `${quiz ? "Moodle quiz" : r.kind === "assign" ? "Assignment" : "Moodle task"} — due ${new Date(r.due_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}. Leaves once you submit it on Moodle.`,
      source: "moodle",
      from_address: "Moodle",
      links: r.url ? [r.url] : [],
      score: 9,
      status: "new",
      deadline_at: r.due_at,
      section: quiz ? "exams" : "action",
      when: r.due_at,
      myCourse: r.course_code,
    };
    sections[item.section].push(item);
    sections.all.push(item);
  }
  sections.action.sort((a, b) => t(a) - t(b));
  sections.exams.sort((a, b) => t(a) - t(b));
}

/** Why the board is empty, and the way out. */
function noTimetableText(year?: string | null, division?: string | null): string {
  if (String(year || "") === "1" && division && coursesForDivision(division).length === 0)
    return `We don't have the ${division} timetable yet. Connect Moodle or add your courses in Settings.`;
  if (String(year || "") !== "1") return "We only have first-year timetables so far. Connect Moodle or add your courses in Settings.";
  return "Connect Moodle or add your courses in Settings to see your classes here.";
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("subscribers")
    .select("onboarded_at, name, last_seen_at, muted_senders, year, division")
    .eq("email", user.email)
    .single();
  if (!profile?.onboarded_at) redirect("/welcome");

  const now = new Date();
  // 21 days so deadlines and upcoming events announced earlier stay on the board.
  const since = new Date(now.getTime() - 21 * 86400_000).toISOString();
  const today = istDate(now.toISOString());

  // New student with nothing yet: fill recent notices and the division's common courses right away.
  const [{ count: haveItems }, { count: haveCourses }] = await Promise.all([
    supabase.from("user_items").select("item_id", { count: "exact", head: true }).eq("email", (user.email || "").toLowerCase()),
    supabase.from("user_courses").select("course_code", { count: "exact", head: true }),
  ]);
  if (!haveItems) await supabase.rpc("backfill_my_feed");
  if (!haveCourses && String(profile?.year || "") === "1") {
    const rows = coursesForDivision(profile?.division).map((c) => ({ ...c, user_id: user.id }));
    if (rows.length) await supabase.from("user_courses").upsert(rows, { onConflict: "user_id,course_code", ignoreDuplicates: true });
  }

  const [feedRes, coursesRes, updatesRes, cardsRes, savedRes, enrolRes, dueRes] = await Promise.all([
    supabase.rpc("me_feed", { p_since: since, p_min_score: MIN_SCORE }),
    supabase.from("user_courses").select("course_code, title, division, lecture_slots, tutorial_slots, venue"),
    supabase.from("course_updates").select("*").gte("on_date", today).lte("on_date", istDate(new Date(now.getTime() + 8 * 86400_000).toISOString())),
    supabase.from("sponsored_cards").select("id, sponsor, title, body, link, ends_on").lte("starts_on", today).order("created_at", { ascending: false }).limit(5),
    supabase.from("user_schedules").select("id, title, location, start_time, end_time, slot_type, is_cancelled, notice_id").gte("start_time", new Date(now.getTime() - 86400_000).toISOString()).lte("start_time", new Date(now.getTime() + 9 * 86400_000).toISOString()),
    supabase.from("moodle_enrolments").select("course_code"),
    supabase.from("moodle_deadlines").select("event_id, course_code, name, kind, due_at, url").gte("due_at", new Date(now.getTime() - 3600_000).toISOString()).order("due_at"),
  ]);

  const muted = new Set<string>(profile?.muted_senders || []);
  let items = ((feedRes.data || []) as FeedItem[]).filter((i) => !i.from_address || !muted.has(i.from_address));

  // One card per real event: notices about the same quiz/class/talk from Moodle, email and WhatsApp.
  if (items.length) {
    const { data: links } = await supabase.from("event_items").select("item_id, event_id").in("item_id", items.map((i) => i.id));
    if (links?.length) {
      const { data: evs } = await supabase.from("events").select("id, resolved").in("id", [...new Set(links.map((l) => l.event_id))]);
      items = groupByEvent(items, links, (evs || []) as any) as FeedItem[];
    }
  }

  // Your seat from seating plans (RLS: each student reads only their own roll's rows).
  if (items.length) {
    const { data: seats } = await supabase.from("seat_assignments").select("item_id, seat").in("item_id", items.map((i) => i.id));
    const seatBy = new Map((seats || []).map((r) => [r.item_id, r.seat]));
    for (const i of items) i.seat = seatBy.get(i.id) || null;
  }
  const courses = (coursesRes.data || []) as UserCourse[];
  // Your timetable courses plus everything you're enrolled in on Moodle.
  const myCourses = new Set([
    ...courses.map((c) => formatCourseCode(c.course_code)),
    ...(enrolRes.data || []).filter((e) => e.course_code).map((e) => formatCourseCode(e.course_code as string)),
  ]);
  const sections = buildSections(items, myCourses, now);
  addMoodleDeadlines(sections as any, dueRes.data || []);
  const board = boardFor(courses, (updatesRes.data || []) as CourseUpdate[], savedRes.data || [], now);
  const sponsored = ((cardsRes.data || []) as (Sponsored & { ends_on: string | null })[]).find(
    (c) => !c.ends_on || c.ends_on >= today
  );

  // Inactivity tracking for the reminder email (at most one write per hour)
  if (!profile?.last_seen_at || now.getTime() - new Date(profile.last_seen_at).getTime() > 3600_000) {
    await supabase.from("subscribers").update({ last_seen_at: now.toISOString() }).eq("email", (user.email || "").toLowerCase());
  }


  return (
    <>
      <AppBar />
      <main className="wrap">
        <HomeHead name={profile?.name} now={now} action={sections.action} exams={sections.exams} />

        {feedRes.error && <p className="err">Could not load notices: {feedRes.error.message}</p>}

        <div className="home-grid">
          <aside className="home-rail">
            <DayBoard
              title={board.title}
              rows={board.rows}
              emptyText={courses.length ? "No classes scheduled." : noTimetableText(profile?.year, profile?.division)}
            />
            <AskBox />
          </aside>
          <div className="home-main">
            <FeedView sections={sections as any} sponsored={sponsored || null} />
          </div>
        </div>
      </main>
    </>
  );
}
