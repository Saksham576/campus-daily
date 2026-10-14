import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST /api/broadcast/request — any IITB login asks to become a verified broadcaster. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; department?: string; role?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const name = (body.name || "").trim().slice(0, 100);
  if (name.length < 2) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });

  const { error } = await supabase.from("broadcasters").insert({
    user_id: user.id,
    email: (user.email || "").toLowerCase(),
    name,
    department: (body.department || "").trim().slice(0, 100) || null,
    role: (body.role || "").trim().slice(0, 40) || null,
    status: "pending",
  });
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "You have already requested access." : "Could not save request." }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ ok: true });
}
