import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";
import { needsReminder, todaysClasses, reminderEmail, type ReminderSub } from "@/lib/reminder";
import type { CourseUpdate } from "@/lib/timetable/updates";
import type { UserCourse } from "@/lib/timetable/slots";
import { digestPush, digestEmail, type DigestDue } from "@/lib/digest";
import { pushToEmails } from "@/lib/server/push";
import { cleanSubject } from "@/lib/display";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/reminders — Vercel Cron, 07:30 IST daily (vercel.json).
 * 1) Morning digest to everyone (push by default; email if they chose it).
 * 2) Students inactive for 3+ days who didn't get the digest by email get the reminder email.
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
    .select("email, name, personal_email, division, hasmed, onboarded_at, last_seen_at, last_reminded_at, user_id, digest")
    .is("merged_into", null)
    .not("onboarded_at", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: updates } = await admin.from("course_updates").select("*").eq("on_date", today);
  const week = new Date(now.getTime() + 7 * 86400_000).toISOString();
  const fortnight = new Date(now.getTime() + 14 * 86400_000).toISOString();

  // ---- 1) Morning digest ----
  const digest = { pushed: 0, emailed: 0 };
  const emailedDigest = new Set<string>();
  for (const s of (subs || []) as (ReminderSub & { digest?: string })[]) {
    const mode = s.digest || "push";
    if (mode === "off" || Date.now() - now.getTime() > 45_000) continue;
    const [{ data: courses }, { data: md }, { data: notices }] = await Promise.all([
      s.user_id
        ? admin.from("user_courses").select("course_code, title, division, lecture_slots, tutorial_slots, venue").eq("user_id", s.user_id)
        : Promise.resolve({ data: [] as any[] }),
      s.user_id
        ? admin.from("moodle_deadlines").select("course_code, name, kind, due_at").eq("user_id", s.user_id).gte("due_at", now.toISOString()).lte("due_at", fortnight).order("due_at")
        : Promise.resolve({ data: [] as any[] }),
      admin.from("user_items").select("items!inner(subject, deadline_at)").eq("email", s.email).eq("state", "new").gte("score", 6).gte("items.deadline_at", now.toISOString()).lte("items.deadline_at", week),
    ]);
    const classes = todaysClasses((courses || []) as UserCourse[], (updates || []) as CourseUpdate[], now);
    const label = (d: any) => `${d.course_code ? d.course_code + ": " : ""}${d.name}`;
    const due: DigestDue[] = [
      ...(md || []).filter((d: any) => d.kind !== "quiz" && d.due_at <= week).map((d: any) => ({ title: label(d), due_at: d.due_at, kind: d.kind })),
      ...(notices || []).map((r: any) => ({ title: cleanSubject(String(r.items.subject)), due_at: r.items.deadline_at })),
    ].sort((a, b) => a.due_at.localeCompare(b.due_at));
    const exams: DigestDue[] = (md || []).filter((d: any) => d.kind === "quiz").map((d: any) => ({ title: label(d), due_at: d.due_at, kind: "quiz" }));

    if (mode === "push" || mode === "both") {
      const p = digestPush(classes, due, exams);
      if (p && (await pushToEmails(admin, [s.email], { ...p, url: "/", tag: "digest" })) > 0) digest.pushed++;
    }
    if ((mode === "email" || mode === "both") && resendKey) {
      const mail = digestEmail(s.name, classes, due, exams);
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
        digest.emailed++;
        emailedDigest.add(s.email);
      }
    }
    await admin.from("subscribers").update({ last_digest_at: now.toISOString() }).eq("email", s.email);
  }

  // ---- 2) Inactivity reminder ----
  const due = ((subs || []) as ReminderSub[]).filter((s) => needsReminder(s, now) && !emailedDigest.has(s.email));

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

    const { data: courses } = s.user_id
      ? await admin
          .from("user_courses")
          .select("course_code, title, division, lecture_slots, tutorial_slots, venue")
          .eq("user_id", s.user_id)
      : { data: [] };
    const mail = reminderEmail(s, todaysClasses((courses || []) as UserCourse[], (updates || []) as CourseUpdate[], now), notices);
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

  return NextResponse.json({ ok: true, digest, due: due.length, sent, failures });
}
