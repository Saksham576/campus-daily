import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/server/admin";
import { readSource } from "@/lib/server/instagramSources";
import { normaliseHandle } from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Follow an Instagram page for yourself: its posts reach you only. Free: it uses the same single read
 * the shared pages use, and each student can follow three. A link to anything else goes to the team as a request.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const email = user.email.toLowerCase();

  const body = (await req.json().catch(() => ({}))) as { link?: string };
  const raw = String(body.link || "").trim().slice(0, 300);
  if (raw.length < 2) return NextResponse.json({ error: "Paste the page's link or @handle." }, { status: 400 });

  // Not Instagram? Keep it for the team instead of losing it.
  if (/^https?:\/\//i.test(raw) && !/instagram\.com/i.test(raw)) {
    await supabase.from("feature_requests").insert({ email, user_id: user.id, kind: "group", text: `Add this source: ${raw}`, context: "personal-source" });
    return NextResponse.json({ ok: true, requested: true, message: "That isn't an Instagram page, so we've sent it to the team as a request." });
  }

  const handle = normaliseHandle(raw);
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) return NextResponse.json({ error: "That doesn't look like an Instagram handle." }, { status: 400 });

  const { data: mine } = await supabase.from("instagram_sources").select("id, handle").eq("owner_email", email);
  if ((mine || []).some((m) => m.handle === handle)) return NextResponse.json({ error: "You already follow that page." }, { status: 409 });
  if ((mine || []).length >= 3) return NextResponse.json({ error: "You can follow up to 3 pages of your own. Remove one first, or ask us to add it for everyone." }, { status: 400 });

  const token = process.env.INSTAGRAM_TOKEN;
  const me = process.env.INSTAGRAM_USER_ID;
  const admin = getAdminClient();
  if (!token || !me || !admin) return NextResponse.json({ error: "Instagram isn't switched on yet." }, { status: 503 });

  const { data: row, error } = await supabase.from("instagram_sources").insert({ handle, owner_email: email, enabled: true, note: "personal" }).select("id, handle, last_posted_at, owner_email").single();
  if (error || !row) return NextResponse.json({ error: error?.message || "Couldn't add that page." }, { status: 400 });

  // Read it once now: proves it can be read, and fills the first posts.
  try {
    const r = await readSource(admin, row, token, me);
    return NextResponse.json({ ok: true, handle, filed: r.filed });
  } catch (e) {
    await supabase.from("instagram_sources").delete().eq("id", row.id);
    const msg = e instanceof Error ? e.message : "";
    const unreadable = /no data|Invalid user|not a Business|cannot be|unsupported/i.test(msg);
    return NextResponse.json(
      {
        error: unreadable
          ? `@${handle} can't be read. Instagram only lets us read Business or Creator pages (most clubs are). Ask the page to switch, or send it to us as a request.`
          : `Couldn't check @${handle} just now. Try again in a few minutes.`,
      },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: number };
  if (!id) return NextResponse.json({ error: "Missing page." }, { status: 400 });
  await supabase.from("instagram_sources").delete().eq("id", id).eq("owner_email", user.email.toLowerCase());
  return NextResponse.json({ ok: true });
}
