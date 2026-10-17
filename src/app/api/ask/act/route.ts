import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateAction } from "@/lib/actions";

export const runtime = "nodejs";

/**
 * POST /api/ask/act { action } — runs ONE action the student confirmed, as the student (RLS).
 * Re-validated here: the client (and the AI before it) is never trusted.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const email = user.email.toLowerCase();
  const { action: raw } = await req.json().catch(() => ({ action: null }));

  const { data: sub } = await supabase.from("subscribers").select("muted_senders, keywords, categories").eq("email", email).maybeSingle();
  const muted: string[] = sub?.muted_senders || [];
  // Notices must be ones this student can see (has a user_items row).
  let noticeIds: string[] = [];
  if (raw && (raw.type === "hide_notice" || raw.type === "save_notice") && typeof raw.notice === "string") {
    const { data } = await supabase.from("user_items").select("item_id").eq("email", email).eq("item_id", raw.notice).limit(1);
    noticeIds = (data || []).map((r) => r.item_id);
  }
  const senders = raw?.type === "mute_sender" && typeof raw.sender === "string" ? [raw.sender.trim().slice(0, 200)] : [];
  const a = validateAction(raw, { noticeIds, senders, muted });
  if (!a) return NextResponse.json({ error: "That change isn't allowed." }, { status: 400 });

  const kw = (sub?.keywords || "").split(",").map((k: string) => k.trim()).filter(Boolean);
  const cats: string[] = sub?.categories || [];
  let error: { message: string } | null = null;
  switch (a.type) {
    case "mute_sender":
      ({ error } = await supabase.from("subscribers").update({ muted_senders: Array.from(new Set([...muted, a.sender])) }).eq("email", email));
      break;
    case "unmute_sender":
      ({ error } = await supabase.from("subscribers").update({ muted_senders: muted.filter((m) => m !== a.sender) }).eq("email", email));
      break;
    case "set_digest":
      ({ error } = await supabase.from("subscribers").update({ digest: a.mode }).eq("email", email));
      break;
    case "add_keywords":
    case "remove_keywords": {
      const lower = a.keywords.map((k) => k.toLowerCase());
      const next = a.type === "add_keywords" ? Array.from(new Set([...kw, ...a.keywords])) : kw.filter((k: string) => !lower.includes(k.toLowerCase()));
      const v = next.join(", ") || null;
      ({ error } = await supabase.from("subscribers").update({ keywords: v, interests: v }).eq("email", email));
      break;
    }
    case "add_category":
    case "remove_category": {
      const next = a.type === "add_category" ? Array.from(new Set([...cats, a.category])) : cats.filter((c) => c !== a.category);
      ({ error } = await supabase.from("subscribers").update({ categories: next, category: next.join(", ") }).eq("email", email));
      break;
    }
    case "hide_notice":
    case "save_notice":
      ({ error } = await supabase
        .from("user_items")
        .update({ state: a.type === "hide_notice" ? "removed" : "kept", updated_at: new Date().toISOString() })
        .eq("email", email)
        .eq("item_id", a.notice));
      break;
    case "add_to_timetable":
      ({ error } = await supabase.from("user_schedules").insert({
        user_id: user.id,
        title: a.title,
        location: a.location || "IIT Bombay",
        start_time: a.start,
        end_time: a.end,
        slot_type: "custom",
        is_cancelled: false,
      }));
      break;
  }
  if (error) return NextResponse.json({ error: "Couldn't save that. Try in Settings." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
