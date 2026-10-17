import type { NextRequest } from "next/server";
import { isAuthorizedIngest, isGoogleIngestIdentity } from "@/lib/ingest";

/** The WhatsApp bridge (x-ingest-secret) or the ingest Gmail's Apps Script (Google ID token). */
export async function isIngestCaller(req: NextRequest): Promise<boolean> {
  if (isAuthorizedIngest(req.headers.get("x-ingest-secret"), process.env.INGEST_SECRET_KEY)) return true;
  return isGoogleIngestIdentity(req.headers.get("authorization"), process.env.INGEST_GMAIL || "campusdaily.ingest@gmail.com");
}
