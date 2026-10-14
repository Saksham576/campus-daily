import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isAuthorizedIngest,
  parseInboundEmail,
  scoreWithGemini,
  buildItemRow,
} from "@/lib/ingest";
import { updateFromNotice } from "@/lib/timetable/updates";

export const runtime = "nodejs";

/**
 * POST /api/ingest/email
 * Header: x-ingest-secret: <INGEST_SECRET_KEY>
 * Body:   { messageId?, subject, from, date?, text?, html? }
 * Called by a Cloudflare Email Worker for ingest@campusdaily.nexuspulsetech.com.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedIngest(req.headers.get("x-ingest-secret"), process.env.INGEST_SECRET_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bcqzlxftcsgjmgaddqjz.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!serviceKey || !geminiKey) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = parseInboundEmail(payload);
  if (!email) return NextResponse.json({ error: "No usable email content" }, { status: 400 });

  let scored;
  try {
    scored = await scoreWithGemini(email, geminiKey);
  } catch (err) {
    console.error("ingest: scoring failed", err instanceof Error ? err.message : "unknown");
    // Let the Worker retry later rather than storing an unscored notice.
    return NextResponse.json({ error: "Scoring unavailable" }, { status: 502 });
  }
  if (!scored) return NextResponse.json({ error: "Unscorable email" }, { status: 422 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const row = buildItemRow(email, scored);
  const { error } = await admin.from("items").upsert(row, { onConflict: "id" });
  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });

  // Self-updating timetable: record course-level cancellations, moves and quizzes.
  const update = updateFromNotice(email.subject, email.body, row.id);
  if (update) {
    const { error: upErr } = await admin.from("course_updates").upsert(update, { onConflict: "notice_id" });
    if (upErr) console.error("ingest: course update failed", upErr.message);
  }

  return NextResponse.json({ ok: true, id: row.id, score: row.score, timetable_update: update?.kind ?? null });
}
