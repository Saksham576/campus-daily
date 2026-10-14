import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedIngest, parseInboundEmail } from "@/lib/ingest";
import { processInbound } from "@/lib/server/ingestPipeline";

export const runtime = "nodejs";

/**
 * POST /api/ingest/email
 * Header: x-ingest-secret: <INGEST_SECRET_KEY>
 * Body:   { messageId?, subject, from, date?, text?, html? }
 * Used by the WhatsApp bridge and any trusted forwarder.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedIngest(req.headers.get("x-ingest-secret"), process.env.INGEST_SECRET_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = parseInboundEmail(payload);
  if (!email) return NextResponse.json({ error: "No usable email content" }, { status: 400 });

  const { status, body } = await processInbound(email);
  return NextResponse.json(body, { status });
}
