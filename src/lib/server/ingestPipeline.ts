import { getAdminClient } from "@/lib/server/admin";
import { createHash } from "node:crypto";
import { scoreWithGemini, buildItemRow, personalizeScore, privateMailReason, contentIdFor, type InboundEmail } from "@/lib/ingest";
import { forwardToken, isPersonalMail } from "@/lib/forwarding";
import { extractEventDetails } from "@/lib/events";
import { updateFromNotice } from "@/lib/timetable/updates";
import { publishNotice } from "@/lib/server/publish";
import { docId } from "@/lib/server/docWorker";

/** Score, store, fan out and apply timetable changes for one inbound notice (+ its attachments). */
export async function processInbound(email: InboundEmail): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await processNotice(email);
  const files = email.attachments || [];
  if (!files.length) return res;
  const admin = getAdminClient();
  if (!admin) return res;
  const id = res.status === 200 && typeof res.body.id === "string" ? res.body.id : null;
  if (id) {
    // Read later by the document worker; visible to the students who received this notice.
    await admin.from("documents").upsert(
      files.map((a) => ({
        id: docId("att", a.path),
        source: email.from.startsWith("WhatsApp:") ? "whatsapp" : "mail",
        item_id: id,
        name: a.name,
        mime: a.mime,
        storage_path: a.path,
      })),
      { onConflict: "id", ignoreDuplicates: true }
    );
    return { ...res, body: { ...res.body, attachments: files.length } };
  }
  // Not published (private, duplicate, unreadable or failed): don't keep the files.
  await admin.storage.from("attachments").remove(files.map((a) => a.path));
  return res;
}

async function processNotice(email: InboundEmail): Promise<{ status: number; body: Record<string, unknown> }> {
  const admin = getAdminClient();
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!admin || !geminiKey) return { status: 500, body: { error: "Server not configured" } };

  // Never publish login codes or personal (non-IITB) mail from the forwarded inbox.
  const skip = privateMailReason(email);
  if (skip) return { status: 200, body: { ok: true, skipped: skip } };

  // The Moodle reader may already have posted this announcement (same "COURSE: subject").
  if (/moodle/i.test(email.from)) {
    const { count } = await admin
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("subject", email.subject)
      .eq("source", "moodle")
      .gte("received_at", new Date(Date.now() - 14 * 86400_000).toISOString());
    if (count) return { status: 200, body: { ok: true, skipped: "already from Moodle" } };
  }

  // Whose inbox is this from? (campusdaily.inbox+<token>@gmail.com — see Settings → IITB mail)
  const token = forwardToken(email);
  let owner: string | null = null;
  if (token) {
    const { data } = await admin.from("subscribers").select("email").eq("forward_token", token).maybeSingle();
    owner = data?.email || null;
    if (owner) await admin.from("subscribers").update({ last_forward_at: new Date().toISOString() }).eq("email", owner);
  }
  const listMail = !owner || !isPersonalMail(email, owner);

  // The same list mail arrives once per forwarding student: process it only the first time.
  if (listMail) {
    const { count } = await admin.from("items").select("id", { count: "exact", head: true }).eq("id", contentIdFor(email));
    if (count) return { status: 200, body: { ok: true, duplicate: true } };
  }

  let scored;
  try {
    scored = await scoreWithGemini(email, geminiKey);
  } catch (err) {
    console.error("ingest: scoring failed", err instanceof Error ? err.message : "unknown");
    // Let the sender retry later rather than storing an unscored notice.
    return { status: 502, body: { error: "Scoring unavailable" } };
  }
  if (!scored) return { status: 422, body: { error: "Unscorable email" } };
  // Personal mail from a forward we can't attribute (old rule without +token): never show it to everyone.
  if (!owner && scored.is_personal && !email.from.startsWith("WhatsApp:")) return { status: 200, body: { ok: true, skipped: "personal mail without owner" } };

  // Personal mail (sent to this student, not a list) is shown to them alone, under its own id.
  const personal = Boolean(owner) && isPersonalMail(email, owner!, scored.is_personal);
  const ev = extractEventDetails(email.subject, email.body);
  const base = buildItemRow(email, scored, {
    source: email.from.startsWith("WhatsApp:") ? "whatsapp" : email.from.startsWith("Web:") ? "web" : email.from.startsWith("Instagram:") ? "instagram" : "ingest-mail",
    venue: ev?.location ?? email.venue ?? null,
    deadline_at: ev && ev.slot_type === "deadline" ? ev.start_time : null,
  });
  const row = personal ? { ...base, id: `${base.id}_${createHash("sha256").update(owner!).digest("hex").slice(0, 8)}`, is_personal: true } : base;
  // A personal mail never changes everyone's timetable.
  const update = personal ? null : updateFromNotice(email.subject, email.body, row.id, new Date(email.date));

  try {
    const result = await publishNotice(admin, row, (s) => personalizeScore(scored, s), update, personal ? { only: [owner!] } : undefined);
    return { status: 200, body: { ok: true, id: row.id, score: scored.score, ...result, timetable_update: update?.kind ?? null } };
  } catch (err) {
    console.error("ingest:", err instanceof Error ? err.message : "publish failed");
    return { status: 500, body: { error: "Database error" } };
  }
}
