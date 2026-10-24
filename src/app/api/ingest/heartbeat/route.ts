import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedIngest } from "@/lib/ingest";
import { getAdminClient } from "@/lib/server/admin";

export const runtime = "nodejs";

/** POST /api/ingest/heartbeat — the WhatsApp bridge reports what it is watching (shown on /admin). */
export async function POST(req: NextRequest) {
  if (!isAuthorizedIngest(req.headers.get("x-ingest-secret"), process.env.INGEST_SECRET_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  let data: Record<string, unknown> = {};
  try {
    data = await req.json();
  } catch {}
  // Keep only counters and group names — never message content.
  const clean = {
    groups: Array.isArray(data.groups) ? (data.groups as unknown[]).filter((g) => typeof g === "string").slice(0, 200) : [],
    seenToday: Number(data.seenToday) || 0,
    forwardedToday: Number(data.forwardedToday) || 0,
    caughtUp: Number(data.caughtUp) || 0,
    startedAt: typeof data.startedAt === "string" ? data.startedAt : null,
    lastMessageAt: typeof data.lastMessageAt === "string" ? data.lastMessageAt : null,
    // Login QR while the bridge is logged out (admins scan it from /admin). Short-lived.
    qr: typeof data.qr === "string" && data.qr.length < 2000 ? data.qr : null,
    // 8-character pairing code when the bridge links by phone number instead of QR.
    code: typeof data.code === "string" && /^[A-Z0-9-]{6,12}$/i.test(data.code) ? data.code : null,
  };
  await admin.from("bridge_status").upsert({ id: "whatsapp", data: clean, updated_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
