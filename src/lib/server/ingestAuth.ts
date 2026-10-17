import type { NextRequest } from "next/server";
import { isAuthorizedIngest, isGoogleIngestIdentity } from "@/lib/ingest";

/** The WhatsApp bridge (x-ingest-secret) or the ingest Gmail's Apps Script (Google ID token). */
export async function isIngestCaller(req: NextRequest): Promise<boolean> {
  if (isAuthorizedIngest(req.headers.get("x-ingest-secret"), process.env.INGEST_SECRET_KEY)) return true;
  // The current ingest Gmail, plus the old one while students move their forwarding over.
  const inboxes = (process.env.INGEST_GMAIL || "campusdaily.inbox@gmail.com,campusdaily.ingest@gmail.com").split(",");
  return isGoogleIngestIdentity(req.headers.get("authorization"), inboxes);
}
