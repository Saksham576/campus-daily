import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { syncMoodle } from "@/lib/server/moodleSync";
import { isCronAuthorized } from "@/lib/server/cronAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/cron/moodle — every 15 min (Supabase pg_cron; GitHub Actions as a backup). */
export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  if (!(await isCronAuthorized(req, admin))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin || !process.env.MOODLE_TOKEN_KEY) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const stats = await syncMoodle(admin, Date.now() + 48_000);
  return NextResponse.json({ ok: true, ...stats });
}
