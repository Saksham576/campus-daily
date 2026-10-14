import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/server/admin";
import { buildBroadcast, type BroadcastInput } from "@/lib/broadcast";
import { publishNotice } from "@/lib/server/publish";
import { takesCourse } from "@/lib/timetable/courses";

export const runtime = "nodejs";

/** POST /api/broadcast — approved instructors post a verified notice (optionally changing the timetable). */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const { data: who } = await admin
    .from("broadcasters")
    .select("user_id, name, role, department, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!who || who.status !== "approved") {
    return NextResponse.json({ error: "Your broadcaster access is not approved yet." }, { status: 403 });
  }

  let input: BroadcastInput;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const built = buildBroadcast(input, who);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const { row, update } = built;
  try {
    // Verified notices rank high for everyone; students in the course see them at the top.
    const result = await publishNotice(
      admin,
      row,
      (s) => (update && takesCourse(s, update.course_code) ? 10 : 8),
      update
    );
    return NextResponse.json({ ok: true, id: row.id, ...result, timetable_update: update?.kind ?? null });
  } catch (err) {
    console.error("broadcast:", err instanceof Error ? err.message : "publish failed");
    return NextResponse.json({ error: "Could not publish" }, { status: 500 });
  }
}
