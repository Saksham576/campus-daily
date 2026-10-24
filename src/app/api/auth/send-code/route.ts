import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { isAllowedEmail, sanitizeRedirectUrl } from "@/lib/auth";
import { buildSigninEmail, rateLimitReason } from "@/lib/signinEmail";

export const runtime = "nodejs";

/**
 * POST /api/auth/send-code  { email, mode: "login" | "signup", next }
 * Campus Daily sends its own sign-in email (6-digit code + scanner-safe link) through Resend,
 * so it doesn't depend on Supabase's email templates.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; mode?: string; next?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const email = (body.email || "").trim().toLowerCase();
  const mode = body.mode === "login" ? "login" : "signup";
  if (!isAllowedEmail(email)) {
    return NextResponse.json({ error: "Use your IITB email (…@iitb.ac.in)." }, { status: 400 });
  }

  const admin = getAdminClient();
  const resendKey = process.env.RESEND_API_KEY;
  if (!admin || !resendKey) return NextResponse.json({ error: "Sign-in is not configured." }, { status: 500 });

  const { data: recent } = await admin
    .from("auth_email_log")
    .select("sent_at")
    .eq("email", email)
    .gte("sent_at", new Date(Date.now() - 3_600_000).toISOString());
  const limited = rateLimitReason((recent || []).map((r) => r.sent_at));
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  if (mode === "signup") {
    // Create the account if it doesn't exist yet (IITB email is the identity).
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error && !/already|registered|exists/i.test(error.message)) {
      console.error("send-code: createUser failed", error.message);
      return NextResponse.json({ error: "Could not create your account. Try again." }, { status: 500 });
    }
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties) {
    if (mode === "login" && /not found|no user/i.test(error?.message || "")) {
      return NextResponse.json({ error: "no_account" }, { status: 404 });
    }
    console.error("send-code: generateLink failed", error?.message);
    return NextResponse.json({ error: "Could not create a code. Try again." }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  const link = `${origin}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=email&next=${encodeURIComponent(
    sanitizeRedirectUrl(body.next)
  )}`;
  const mail = buildSigninEmail(data.properties.email_otp, link);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.SIGNIN_FROM || "Campus Daily <signin@campusdaily.nexuspulsetech.com>",
      to: [email],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) {
    console.error("send-code: resend failed", res.status);
    return NextResponse.json({ error: "Could not send the email. Try again in a minute." }, { status: 502 });
  }

  await admin.from("auth_email_log").insert({ email });
  return NextResponse.json({ ok: true });
}
