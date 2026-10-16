import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/server/admin";
import { encryptSecret } from "@/lib/server/crypto";
import { moodleCall } from "@/lib/moodle";

export const runtime = "nodejs";

/**
 * POST /api/moodle/connect { key }
 * IITB Moodle signs in through IIT Bombay SSO, so students paste their personal
 * "Moodle mobile web service" key (Moodle → Preferences → Security keys). We check it with
 * Moodle and keep it only encrypted. No password ever reaches Campus Daily.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getAdminClient();
  if (!admin || !process.env.MOODLE_TOKEN_KEY) return NextResponse.json({ error: "Moodle is not configured yet." }, { status: 500 });

  let body: { key?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const key = (body.key || "").trim();
  if (!/^[a-f0-9]{32}$/i.test(key)) {
    return NextResponse.json({ error: "That doesn't look like a Moodle key — it's 32 letters and numbers. Copy it again." }, { status: 400 });
  }

  try {
    const info = await moodleCall<{ userid: number; fullname: string; username?: string }>(key, "core_webservice_get_site_info");
    const { error } = await admin.from("moodle_connections").upsert({
      user_id: user.id,
      moodle_userid: info.userid,
      moodle_fullname: info.fullname,
      token_enc: encryptSecret(key),
      connected_at: new Date().toISOString(),
      last_error: null,
    });
    if (error) throw new Error("save");
    return NextResponse.json({ ok: true, name: info.fullname });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return NextResponse.json(
      { error: /invalidtoken|accessexception/i.test(msg) ? "Moodle didn't accept that key. Copy the 'Moodle mobile web service' key again (or Reset it)." : "Could not reach Moodle. Try again in a minute." },
      { status: 400 }
    );
  }
}
