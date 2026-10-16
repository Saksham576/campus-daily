import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { syncMoodle } from "@/lib/server/moodleSync";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/cron/moodle — every 30 min (GitHub Actions: .github/workflows/moodle-sync.yml). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = getAdminClient();
  if (!admin || !process.env.MOODLE_TOKEN_KEY) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const stats = await syncMoodle(admin, Date.now() + 48_000);
  return NextResponse.json({ ok: true, ...stats });
}
