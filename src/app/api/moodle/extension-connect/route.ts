import { NextResponse, after, type NextRequest } from "next/server";
import { syncMoodle } from "@/lib/server/moodleSync";
import { getAdminClient } from "@/lib/server/admin";
import { saveMoodleKey, tokenFromLaunchRedirect } from "@/lib/server/moodleConnect";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/moodle/extension-connect { passport, redirect }
 * Sent by the Campus Daily Connect browser extension when Moodle's app login redirects.
 * The passport is single-use and tied to the student who started the connect (15 min).
 */
export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin || !process.env.MOODLE_TOKEN_KEY) return NextResponse.json({ error: "Not configured." }, { status: 500 });
  const { passport, redirect } = await req.json().catch(() => ({}) as any);
  if (!/^[a-f0-9]{32}$/.test(String(passport || "")) || typeof redirect !== "string") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { data: nonce } = await admin
    .from("moodle_connect_nonces")
    .delete()
    .eq("passport", passport)
    .gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString())
    .select("user_id")
    .maybeSingle();
  if (!nonce?.user_id) return NextResponse.json({ error: "This connect link expired. Start again from Campus Daily." }, { status: 410 });

  const key = tokenFromLaunchRedirect(redirect, passport);
  if (!key) return NextResponse.json({ error: "Moodle's answer didn't check out." }, { status: 400 });
  try {
    const { name } = await saveMoodleKey(admin, nonce.user_id, key);
    // Full first read (notices, files, deadlines) in the background; the new connection goes first.
    after(() => syncMoodle(admin, Date.now() + 50_000).catch(() => null));
    return NextResponse.json({ ok: true, name });
  } catch {
    return NextResponse.json({ error: "Moodle didn't accept the key." }, { status: 400 });
  }
}
