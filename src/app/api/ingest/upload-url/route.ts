import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { isIngestCaller } from "@/lib/server/ingestAuth";
import { docKind, MAX_DOC_BYTES } from "@/lib/docs/extract";

export const runtime = "nodejs";

/**
 * POST /api/ingest/upload-url { name, mime?, size? } → { path, url }
 * A one-time link to upload a mail / WhatsApp attachment straight into the private attachments
 * bucket (PUT the bytes to url), then list { path, name, mime } in the ingest payload.
 * Only document types we can read (PDF, Word, PowerPoint, Excel, text).
 */
export async function POST(req: NextRequest) {
  if (!(await isIngestCaller(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const { name, mime, size } = await req.json().catch(() => ({}) as any);
  const fileName = String(name || "")
    .replace(/[\/\\\u0000-\u001f]/g, "_")
    .trim()
    .slice(0, 140);
  if (!fileName || !docKind(fileName, mime)) return NextResponse.json({ error: "Not a document we read" }, { status: 422 });
  if (Number(size) > MAX_DOC_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });

  const path = `${new Date().toISOString().slice(0, 7)}/${randomBytes(8).toString("hex")}/${fileName}`;
  const { data, error } = await admin.storage.from("attachments").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Could not create upload link" }, { status: 500 });
  return NextResponse.json({ path, url: data.signedUrl });
}
