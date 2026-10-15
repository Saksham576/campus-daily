import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedIngest, isGoogleIngestIdentity, parseInboundEmail } from "@/lib/ingest";
import { processInbound } from "@/lib/server/ingestPipeline";

export const runtime = "nodejs";

/**
 * POST /api/ingest/email
 * Auth:   x-ingest-secret: <INGEST_SECRET_KEY>  (WhatsApp bridge)
 *     or  Authorization: Bearer <Google ID token of INGEST_GMAIL>  (Apps Script)
 * Body:   { messageId?, subject, from, date?, text?, html? }
 * Used by the WhatsApp bridge and any trusted forwarder.
 */
export async function POST(req: NextRequest) {
  const bySecret = isAuthorizedIngest(req.headers.get("x-ingest-secret"), process.env.INGEST_SECRET_KEY);
  const byGoogle =
    !bySecret &&
    (await isGoogleIngestIdentity(req.headers.get("authorization"), process.env.INGEST_GMAIL || "campusdaily.ingest@gmail.com"));
  if (!bySecret && !byGoogle) {
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
