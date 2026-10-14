import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient, isAdminEmail } from "@/lib/server/admin";

type Action =
  | { type: "decide_broadcaster"; user_id: string; status: "approved" | "rejected" }
  | { type: "create_card"; sponsor: string; title: string; body?: string; link?: string; starts_on?: string; ends_on?: string }
  | { type: "toggle_card"; id: string; active: boolean };

const safeLink = (l?: string) => {
  if (!l) return null;
  try {
    const u = new URL(l);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** POST /api/admin — admin-only actions (ADMIN_EMAILS). */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  let a: Action;
  try {
    a = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (a.type === "decide_broadcaster" && (a.status === "approved" || a.status === "rejected")) {
    const { error } = await admin
      .from("broadcasters")
      .update({ status: a.status, decided_at: new Date().toISOString() })
      .eq("user_id", a.user_id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }

  if (a.type === "create_card") {
    if (!a.sponsor?.trim() || !a.title?.trim()) return NextResponse.json({ error: "Sponsor and title are required." }, { status: 400 });
    if (a.link && !safeLink(a.link)) return NextResponse.json({ error: "Link must start with https://" }, { status: 400 });
    const { error } = await admin.from("sponsored_cards").insert({
      sponsor: a.sponsor.trim().slice(0, 80),
      title: a.title.trim().slice(0, 120),
      body: a.body?.trim().slice(0, 300) || null,
      link: safeLink(a.link),
      starts_on: a.starts_on || undefined,
      ends_on: a.ends_on || null,
    });
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }

  if (a.type === "toggle_card") {
    const { error } = await admin.from("sponsored_cards").update({ active: Boolean(a.active) }).eq("id", a.id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
