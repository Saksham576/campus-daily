import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { isCronAuthorized } from "@/lib/server/cronAuth";
import { runWebSources } from "@/lib/server/webSources";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/cron/web-sources — every 30 min (Supabase pg_cron): read public IITB pages for new announcements and events. */
export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  if (!(await isCronAuthorized(req, admin))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const stats = await runWebSources(admin, Date.now() + 50_000);
  return NextResponse.json({ ok: true, ...stats });
}
