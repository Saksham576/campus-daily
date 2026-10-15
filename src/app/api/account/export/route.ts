import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/account/export — returns everything stored about the signed-in student as JSON. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = (user.email || "").toLowerCase();
  // RLS limits every query to this user's own rows.
  const [profile, schedules, items, interactions] = await Promise.all([
    supabase.from("subscribers").select("*").eq("email", email),
    supabase.from("user_schedules").select("*").eq("user_id", user.id),
    supabase.from("user_items").select("*").eq("email", email),
    supabase.from("notice_interactions").select("*").eq("user_id", user.id),
  ]);

  const data = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data ?? [],
    schedule: schedules.data ?? [],
    notice_states: items.data ?? [],
    notice_interactions: interactions.data ?? [],
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="campus-daily-my-data.json"',
      "cache-control": "no-store",
    },
  });
}
