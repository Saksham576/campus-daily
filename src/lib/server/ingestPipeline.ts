import { getAdminClient } from "@/lib/server/admin";
import { scoreWithGemini, buildItemRow, personalizeScore, privateMailReason, type InboundEmail } from "@/lib/ingest";
import { extractEventDetails } from "@/lib/events";
import { updateFromNotice } from "@/lib/timetable/updates";
import { publishNotice } from "@/lib/server/publish";

/** Score, store, fan out and apply timetable changes for one inbound notice. */
export async function processInbound(email: InboundEmail): Promise<{ status: number; body: Record<string, unknown> }> {
  const admin = getAdminClient();
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!admin || !geminiKey) return { status: 500, body: { error: "Server not configured" } };

  // Never publish login codes or personal (non-IITB) mail from the forwarded inbox.
  const skip = privateMailReason(email);
  if (skip) return { status: 200, body: { ok: true, skipped: skip } };

  let scored;
  try {
    scored = await scoreWithGemini(email, geminiKey);
  } catch (err) {
    console.error("ingest: scoring failed", err instanceof Error ? err.message : "unknown");
    // Let the sender retry later rather than storing an unscored notice.
    return { status: 502, body: { error: "Scoring unavailable" } };
  }
  if (!scored) return { status: 422, body: { error: "Unscorable email" } };

  const ev = extractEventDetails(email.subject, email.body);
  const row = buildItemRow(email, scored, {
    source: email.from.startsWith("WhatsApp:") ? "whatsapp" : "ingest-mail",
    venue: ev?.location ?? null,
    deadline_at: ev && ev.slot_type === "deadline" ? ev.start_time : null,
  });
  const update = updateFromNotice(email.subject, email.body, row.id, new Date(email.date));

  try {
    const result = await publishNotice(admin, row, (s) => personalizeScore(scored, s), update);
    return { status: 200, body: { ok: true, id: row.id, score: scored.score, ...result, timetable_update: update?.kind ?? null } };
  } catch (err) {
    console.error("ingest:", err instanceof Error ? err.message : "publish failed");
    return { status: 500, body: { error: "Database error" } };
  }
}
