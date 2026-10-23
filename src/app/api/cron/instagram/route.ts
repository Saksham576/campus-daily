import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { isCronAuthorized } from "@/lib/server/cronAuth";
import { runInstagram } from "@/lib/server/instagramSources";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/cron/instagram — every 2 hours (Supabase pg_cron): public posts of watched club accounts. */
export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  if (!(await isCronAuthorized(req, admin))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const stats = await runInstagram(admin, Date.now() + 50_000);
  return NextResponse.json({ ok: true, ...stats });
}
