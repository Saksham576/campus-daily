import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { needsReminder, todaysClasses, reminderEmail, type ReminderSub } from "@/lib/reminder";
import type { CourseUpdate } from "@/lib/timetable/updates";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/reminders — Vercel Cron, 08:00 IST daily (vercel.json).
 * Emails students inactive for 3+ days their day's timetable and top notices.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = getAdminClient();
  const resendKey = process.env.RESEND_API_KEY;
  if (!admin || !resendKey) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const now = new Date();
  const { data: subs, error } = await admin
    .from("subscribers")
    .select("email, name, personal_email, division, hasmed, onboarded_at, last_seen_at, last_reminded_at")
    .is("merged_into", null)
    .not("onboarded_at", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = ((subs || []) as ReminderSub[]).filter((s) => needsReminder(s, now));
  const today = new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: updates } = await admin.from("course_updates").select("*").eq("on_date", today);

  let sent = 0;
  const failures: string[] = [];
  for (const s of due) {
    const { data: top } = await admin
      .from("user_items")
      .select("score, items(subject, summary, received_at)")
      .eq("email", s.email)
      .eq("state", "new")
      .gte("score", 7)
      .order("score", { ascending: false })
      .limit(10);
    const since = now.getTime() - 3 * 86400000;
    const notices = (top || [])
      .map((r: any) => r.items)
      .filter((i: any) => i && new Date(i.received_at).getTime() >= since)
      .slice(0, 3);

    const mail = reminderEmail(s, todaysClasses(s, (updates || []) as CourseUpdate[], now), notices);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM || "Campus Daily <daily@campusdaily.nexuspulsetech.com>",
        to: [s.personal_email || s.email],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (res.ok) {
      sent++;
      await admin.from("subscribers").update({ last_reminded_at: now.toISOString() }).eq("email", s.email);
    } else {
      failures.push(`${res.status}`);
    }
  }

  return NextResponse.json({ ok: true, due: due.length, sent, failures });
}
