import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { generateMultiEventIcs } from "@/lib/events";
import { buildWeek, type UserCourse } from "@/lib/timetable/slots";
import { applyCourseUpdates, istDate, withPersonalOverrides, type CourseUpdate } from "@/lib/timetable/updates";

export const runtime = "nodejs";

/**
 * GET /api/calendar/<token>.ics — live calendar feed for Google/Apple Calendar.
 * Four weeks of classes from the student's courses, with cancellations, venue changes
 * and quizzes from notices applied. Calendar apps re-fetch it every few hours.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/, "");
  if (!/^[0-9a-f-]{36}$/i.test(clean)) return new NextResponse("Not found", { status: 404 });
  const admin = getAdminClient();
  if (!admin) return new NextResponse("Unavailable", { status: 503 });

  const { data: owner } = await admin.from("calendar_tokens").select("user_id").eq("token", clean).maybeSingle();
  if (!owner) return new NextResponse("Not found", { status: 404 });

  const now = new Date();
  const [{ data: courses }, { data: updates }, { data: custom }] = await Promise.all([
    admin.from("user_courses").select("course_code, title, division, lecture_slots, tutorial_slots, venue").eq("user_id", owner.user_id),
    admin.from("course_updates").select("*").gte("on_date", istDate(new Date(now.getTime() - 7 * 86400_000).toISOString())),
    admin.from("user_schedules").select("id, title, location, start_time, end_time, is_cancelled").eq("user_id", owner.user_id).gte("start_time", new Date(now.getTime() - 7 * 86400_000).toISOString()),
  ]);

  const weeks = [0, 7, 14, 21].flatMap((d) =>
    applyCourseUpdates(
      buildWeek((courses || []) as UserCourse[], new Date(now.getTime() + d * 86400_000)).map((s) => ({ ...s, is_cancelled: false })),
      (updates || []) as CourseUpdate[]
    )
  );
  const events = withPersonalOverrides(weeks as any[], (custom || []) as any[])
    .map((s) => ({
      uid: `${Buffer.from(`${s.title}|${s.start_time}`).toString("base64url").slice(0, 40)}@campusdaily`,
      title: `${s.is_cancelled ? "CANCELLED · " : ""}${s.title}`,
      description: s.is_cancelled ? "Cancelled — from a campus notice (Campus Daily)." : "Campus Daily · campusdaily.nexuspulsetech.com",
      location: s.location || undefined,
      start_time: s.start_time,
      end_time: s.end_time || undefined,
    }));

  const ics = generateMultiEventIcs(events).replace("BEGIN:VCALENDAR", "BEGIN:VCALENDAR\r\nX-WR-CALNAME:Campus Daily\r\nREFRESH-INTERVAL;VALUE=DURATION:PT3H\r\nX-PUBLISHED-TTL:PT3H");
  return new NextResponse(ics, {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900" },
  });
}
