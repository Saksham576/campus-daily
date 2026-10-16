import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/server/admin";
import { encryptSecret } from "@/lib/server/crypto";
import { moodleLogin, moodleCall } from "@/lib/moodle";

export const runtime = "nodejs";

/**
 * POST /api/moodle/connect { username, password }
 * Exchanges the student's Moodle login for Moodle's app token. The password is used once
 * and never stored or logged; only the encrypted token is kept.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getAdminClient();
  if (!admin || !process.env.MOODLE_TOKEN_KEY) return NextResponse.json({ error: "Moodle is not configured yet." }, { status: 500 });

  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!username || !password) return NextResponse.json({ error: "Enter your Moodle username and password." }, { status: 400 });

  try {
    const token = await moodleLogin(username, password);
    const info = await moodleCall<{ userid: number; fullname: string }>(token, "core_webservice_get_site_info");
    const { error } = await admin.from("moodle_connections").upsert({
      user_id: user.id,
      moodle_userid: info.userid,
      moodle_fullname: info.fullname,
      token_enc: encryptSecret(token),
      connected_at: new Date().toISOString(),
      last_error: null,
    });
    if (error) throw new Error("Could not save the connection.");
    return NextResponse.json({ ok: true, name: info.fullname });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Moodle login failed.";
    return NextResponse.json({ error: /password|username/i.test(msg) ? msg : "Could not connect to Moodle. Try again." }, { status: 400 });
  }
}
