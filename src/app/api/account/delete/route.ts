import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/account/delete   body: { confirm: "DELETE" }
 * Permanently deletes the signed-in student's profile, schedule, interactions and login.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let confirm = "";
  try {
    confirm = (await req.json()).confirm;
  } catch {}
  if (confirm !== "DELETE") {
    return NextResponse.json({ error: 'Type "DELETE" to confirm.' }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bcqzlxftcsgjmgaddqjz.supabase.co",
    serviceKey,
    { auth: { persistSession: false } }
  );

  const email = (user.email || "").toLowerCase();
  // user_schedules, user_items and notice_interactions cascade from auth.users.
  const { error: subErr } = await admin.from("subscribers").delete().eq("email", email);
  if (subErr) return NextResponse.json({ error: "Could not delete profile" }, { status: 500 });

  const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
  if (authErr) return NextResponse.json({ error: "Could not delete account" }, { status: 500 });

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
