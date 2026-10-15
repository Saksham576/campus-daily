import { NextResponse, type NextRequest } from "next/server";
import { isValidForwardEmailSignature, fromForwardEmailPayload, parseInboundEmail } from "@/lib/ingest";
import { processInbound } from "@/lib/server/ingestPipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ingest/forwardemail?raw=false
 * Forward Email webhook for ingest@in.campusdaily.nexuspulsetech.com.
 * Verified with the X-Webhook-Signature header (FORWARDEMAIL_WEBHOOK_KEY).
 * Non-200 responses make Forward Email retry later, which is what we want on scoring outages.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!isValidForwardEmailSignature(raw, req.headers.get("x-webhook-signature"), process.env.FORWARDEMAIL_WEBHOOK_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = parseInboundEmail(fromForwardEmailPayload(payload));
  // Empty or unscorable mail is acknowledged with 200 so it isn't retried forever.
  if (!email) return NextResponse.json({ ok: false, skipped: "no content" });

  const { status, body } = await processInbound(email);
  return NextResponse.json(body, { status: status === 422 ? 200 : status });
}
