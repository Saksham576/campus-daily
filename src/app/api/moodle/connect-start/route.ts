import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/server/admin";
import { MOODLE_URL } from "@/lib/moodle";

export const runtime = "nodejs";

/** POST /api/moodle/connect-start — a one-time passport for this student, and Moodle's app-login URL. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Not configured." }, { status: 500 });

  const passport = randomBytes(16).toString("hex");
  await admin.from("moodle_connect_nonces").delete().lt("created_at", new Date(Date.now() - 3600_000).toISOString());
  const { error } = await admin.from("moodle_connect_nonces").insert({ passport, user_id: user.id });
  if (error) return NextResponse.json({ error: "Try again." }, { status: 500 });
  const url = `${MOODLE_URL}/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=${passport}&urlscheme=moodlemobile`;
  return NextResponse.json({ url });
}
