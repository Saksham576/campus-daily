import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { parseResobinTimetable } from "@/lib/resobin";

export const runtime = "nodejs";

/**
 * POST /api/resobin/import { passport, timetable } — from the Campus Daily Connect extension.
 * The passport (single use, 10 min) says which student this is; the rows are re-checked here.
 */
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Not configured." }, { status: 500 });
  const { passport, timetable } = await req.json().catch(() => ({}) as any);
  if (!/^[a-f0-9]{32}$/.test(String(passport || ""))) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const { data: nonce } = await admin
    .from("moodle_connect_nonces")
    .delete()
    .eq("passport", passport)
    .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
    .select("user_id")
    .maybeSingle();
  if (!nonce?.user_id) return NextResponse.json({ error: "This import expired. Start again from Campus Daily." }, { status: 410 });

  const courses = parseResobinTimetable(timetable);
  if (!courses.length) return NextResponse.json({ error: "Your ResoBin timetable is empty for this semester. Add your courses on ResoBin first." }, { status: 422 });

  // ResoBin is the student's own list: replace their course list with it.
  await admin.from("user_courses").delete().eq("user_id", nonce.user_id);
  const { error } = await admin.from("user_courses").insert(courses.map((c) => ({ ...c, user_id: nonce.user_id })));
  if (error) return NextResponse.json({ error: "Couldn't save your courses." }, { status: 500 });
  return NextResponse.json({ ok: true, count: courses.length });
}
