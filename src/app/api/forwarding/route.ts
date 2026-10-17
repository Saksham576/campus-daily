import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/server/admin";
import { forwardAddress, newForwardToken } from "@/lib/forwarding";

export const runtime = "nodejs";

/** GET /api/forwarding — your private forwarding address (created on first use) and when mail last arrived. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Not configured." }, { status: 500 });
  const email = user.email.toLowerCase();

  const { data: sub } = await admin.from("subscribers").select("forward_token, last_forward_at").eq("email", email).maybeSingle();
  let token = sub?.forward_token as string | null;
  for (let i = 0; !token && i < 5; i++) {
    const t = newForwardToken();
    const { data, error } = await admin.from("subscribers").update({ forward_token: t }).eq("email", email).is("forward_token", null).select("forward_token");
    if (!error && data?.length) token = t;
    else if (!error) break; // no profile row yet
  }
  if (!token) return NextResponse.json({ error: "Try again." }, { status: 500 });
  return NextResponse.json({ address: forwardAddress(token), lastMailAt: sub?.last_forward_at || null });
}
