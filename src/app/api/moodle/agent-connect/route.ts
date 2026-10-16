import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedIngest } from "@/lib/ingest";
import { getAdminClient } from "@/lib/server/admin";
import { encryptSecret } from "@/lib/server/crypto";
import { moodleCall } from "@/lib/moodle";

export const runtime = "nodejs";

/**
 * POST /api/moodle/agent-connect { email, key }  (x-ingest-secret)
 * Used by the "Connect Moodle" PC helper after the student signs in through IIT Bombay SSO.
 * The key is checked with Moodle, then stored encrypted against that student's account.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedIngest(req.headers.get("x-ingest-secret"), process.env.INGEST_SECRET_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = getAdminClient();
  if (!admin || !process.env.MOODLE_TOKEN_KEY) return NextResponse.json({ error: "Moodle is not configured" }, { status: 500 });

  let body: { email?: string; key?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const email = (body.email || "").trim().toLowerCase();
  const key = (body.key || "").trim();
  if (!/@(\w+\.)*iitb\.ac\.in$/.test(email) || !/^[a-f0-9]{32}$/i.test(key)) {
    return NextResponse.json({ error: "Need an IITB email and a 32-character Moodle key." }, { status: 400 });
  }

  const { data: sub } = await admin.from("subscribers").select("user_id").eq("email", email).maybeSingle();
  if (!sub?.user_id) return NextResponse.json({ error: "Sign in to Campus Daily once with this email first." }, { status: 404 });

  try {
    const info = await moodleCall<{ userid: number; fullname: string }>(key, "core_webservice_get_site_info");
    const { error } = await admin.from("moodle_connections").upsert({
      user_id: sub.user_id,
      moodle_userid: info.userid,
      moodle_fullname: info.fullname,
      token_enc: encryptSecret(key),
      connected_at: new Date().toISOString(),
      last_error: null,
    });
    if (error) throw new Error("save");
    return NextResponse.json({ ok: true, name: info.fullname });
  } catch {
    return NextResponse.json({ error: "Moodle didn't accept that key." }, { status: 400 });
  }
}
