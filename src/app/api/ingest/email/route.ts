import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isAuthorizedIngest,
  parseInboundEmail,
  scoreWithGemini,
  buildItemRow,
  personalizeScore,
} from "@/lib/ingest";
import { extractEventDetails } from "@/lib/events";
import { updateFromNotice } from "@/lib/timetable/updates";

export const runtime = "nodejs";

/**
 * POST /api/ingest/email
 * Header: x-ingest-secret: <INGEST_SECRET_KEY>
 * Body:   { messageId?, subject, from, date?, text?, html? }
 * Called by the inbound-email webhook and the WhatsApp bridge.
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
    // Let the sender retry later rather than storing an unscored notice.
    return NextResponse.json({ error: "Scoring unavailable" }, { status: 502 });
  }
  if (!scored) return NextResponse.json({ error: "Unscorable email" }, { status: 422 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const ev = extractEventDetails(email.subject, email.body);
  const source = email.from.startsWith("WhatsApp:") ? "whatsapp" : "ingest-mail";
  const row = buildItemRow(email, scored, {
    source,
    venue: ev?.location ?? null,
    deadline_at: ev && ev.slot_type === "deadline" ? ev.start_time : null,
  });
  const { error } = await admin.from("items").upsert(row, { onConflict: "id" });
  if (error) {
    console.error("ingest: items upsert failed", error.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Items are only visible to students who have a user_items row (RLS), so fan out scores.
  const { data: subs, error: subErr } = await admin
    .from("subscribers")
    .select("email, department, year, hostel")
    .is("merged_into", null);
  if (subErr) console.error("ingest: subscribers read failed", subErr.message);
  const uiRows = (subs || []).map((s) => ({
    email: s.email,
    item_id: row.id,
    score: personalizeScore(scored, s),
    state: "new",
    scored_by: "ingest",
  }));
  if (uiRows.length > 0) {
    const { error: uiErr } = await admin
      .from("user_items")
      .upsert(uiRows, { onConflict: "email,item_id", ignoreDuplicates: true });
    if (uiErr) console.error("ingest: user_items upsert failed", uiErr.message);
  }

  // Self-updating timetable: record course-level cancellations, moves and quizzes.
  const update = updateFromNotice(email.subject, email.body, row.id);
  if (update) {
    const { error: upErr } = await admin.from("course_updates").upsert(update, { onConflict: "notice_id" });
    if (upErr) console.error("ingest: course update failed", upErr.message);
  }

  return NextResponse.json({
    ok: true,
    id: row.id,
    score: scored.score,
    students: uiRows.length,
    timetable_update: update?.kind ?? null,
  });
}
