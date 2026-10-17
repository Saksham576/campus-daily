import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { isCronAuthorized } from "@/lib/server/cronAuth";
import { processDocs } from "@/lib/server/docWorker";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/cron/docs — every 10 min (Supabase pg_cron): read pending documents into searchable text. */
export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  if (!(await isCronAuthorized(req, admin))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const stats = await processDocs(admin, Date.now() + 45_000);
  const { count } = await admin.from("documents").select("id", { count: "exact", head: true }).eq("status", "pending");
  return NextResponse.json({ ok: true, ...stats, pending: count ?? null });
}
