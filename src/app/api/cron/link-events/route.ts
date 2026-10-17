import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { linkNotice } from "@/lib/server/linkEvents";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/link-events?days=30 (Bearer CRON_SECRET) — link existing notices into events, oldest
 * first. Safe to re-run: already-linked notices keep their event. Stops before the time limit.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 500 });
  const days = Math.min(60, Number(req.nextUrl.searchParams.get("days")) || 30);
  const deadline = Date.now() + 50_000;

  const { data: done } = await admin.from("event_items").select("item_id");
  const linked = new Set((done || []).map((r) => r.item_id));
  const { data: items } = await admin
    .from("items")
    .select("id, subject, body, summary, source, sender, received_at, is_verified")
    .gte("received_at", new Date(Date.now() - days * 86400_000).toISOString())
    .order("received_at", { ascending: true })
    .limit(2000);

  const stats = { scanned: 0, linked: 0, joined: 0, skipped: 0, remaining: 0 };
  for (const it of items || []) {
    if (linked.has(it.id)) continue;
    if (Date.now() > deadline) {
      stats.remaining++;
      continue;
    }
    stats.scanned++;
    const r = await linkNotice(admin, it).catch(() => null);
    if (!r) stats.skipped++;
    else {
      stats.linked++;
      if (r.joined) stats.joined++;
    }
  }
  return NextResponse.json({ ok: true, ...stats });
}
