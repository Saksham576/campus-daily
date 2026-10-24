import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseUpdate } from "@/lib/timetable/updates";
import { takesCourse } from "@/lib/timetable/courses";
import { worthAnAlert } from "@/lib/relevance";
import { pushToEmails } from "@/lib/server/push";
import { linkNotice, type LinkResult } from "@/lib/server/linkEvents";

export type Sub = {
  email: string;
  department: string | null;
  year: string | null;
  hostel: string | null;
  division: string | null;
  hasmed: string | null;
  keywords: string | null;
  categories?: string[] | null;
  user_id?: string | null;
  courses?: string[];
};

export const URGENT_SCORE = 8;

/**
 * Store a notice, give every student a score row (RLS needs it for visibility),
 * record any timetable change, and push urgent ones to phones.
 */
export async function publishNotice(
  admin: SupabaseClient,
  row: { id: string; subject: string; summary?: string | null } & Record<string, unknown>,
  scoreFor: (sub: Sub) => number,
  updateIn: CourseUpdate | CourseUpdate[] | null,
  opts?: { only?: string[] }
) {
  const updates = Array.isArray(updateIn) ? updateIn : updateIn ? [updateIn] : [];
  let update: CourseUpdate | null = updates[0] ?? null;
  const { error } = await admin.from("items").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`items upsert: ${error.message}`);

  const { data, error: subErr } = await admin
    .from("subscribers")
    .select("email, department, year, hostel, division, hasmed, keywords, categories, user_id")
    .is("merged_into", null);
  if (subErr) console.error("publish: subscribers read failed", subErr.message);
  // Personal notices go to their owner only.
  const only = opts?.only?.map((e) => e.toLowerCase());
  const subs = ((data || []) as Sub[]).filter((s) => !only || only.includes(s.email.toLowerCase()));

  // Attach each student's real courses (Settings → My courses) for course-targeted alerts.
  const ids = subs.map((s) => s.user_id).filter(Boolean) as string[];
  if (ids.length > 0) {
    const { data: uc } = await admin.from("user_courses").select("user_id, course_code").in("user_id", ids);
    const byUser = new Map<string, string[]>();
    for (const r of uc || []) byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r.course_code]);
    for (const s of subs) s.courses = s.user_id ? byUser.get(s.user_id) || [] : [];
  }

  const scores = subs.map((s) => ({ sub: s, score: scoreFor(s) }));
  if (scores.length > 0) {
    const { error: uiErr } = await admin.from("user_items").upsert(
      scores.map(({ sub, score }) => ({ email: sub.email, item_id: row.id, score, state: "new", scored_by: "ingest" })),
      { onConflict: "email,item_id", ignoreDuplicates: true }
    );
    if (uiErr) console.error("publish: user_items upsert failed", uiErr.message);
  }

  // Link this notice to the event it describes (same quiz/class/talk from Moodle, email, WhatsApp…).
  // The event — not each notice — owns the timetable change, resolved by source trust then recency.
  let link: LinkResult | null = null;
  try {
    // Personal mail stays out of shared events.
    if (!only && updates.length <= 1) link = await linkNotice(admin, row as any);
  } catch (e) {
    console.error("publish: linking failed", e instanceof Error ? e.message : e);
  }
  if (link) update = link.update;
  else if (updates.length) {
    const { error: upErr } = await admin.from("course_updates").upsert(updates, { onConflict: "notice_id,kind,on_date,slot_type,division", ignoreDuplicates: false });
    if (upErr) console.error("publish: course update failed", upErr.message);
  }
  // Another source repeating what we already knew: no second buzz.
  const repeat = Boolean(link?.joined && !link.changed);

  // Push: timetable changes go to students taking the course; other notices only if urgent.
  const recipients = repeat
    ? []
    : update && update.kind !== "added"
      ? subs.filter((s) => (update.course_code === "*" || takesCourse(s, update.course_code)) && (!update.division || !s.division || s.division.toUpperCase() === update.division.toUpperCase())).map((s) => s.email)
      : scores
          .filter((x) => x.score >= URGENT_SCORE)
          // A buzz is the strictest filter: urgent AND about something this student follows or takes.
          .filter((x) =>
            worthAnAlert(
              {
                subject: row.subject,
                summary: row.summary,
                body: typeof row.body === "string" ? row.body : null,
                tags: row.tags,
                from_address: typeof row.sender === "string" ? row.sender : null,
                source: typeof row.source === "string" ? row.source : null,
                is_personal: Boolean(row.is_personal),
                is_verified: Boolean(row.is_verified),
                deadline_at: typeof row.deadline_at === "string" ? row.deadline_at : null,
              },
              x.sub
            )
          )
          .map((x) => x.sub.email);
  const title =
    update?.kind === "cancelled"
      ? update.course_code === "*" ? "No classes" : `${update.course_code} cancelled`
      : update?.kind === "moved"
      ? `${update.course_code} changed`
      : "Campus Daily: important notice";
  const pushed = await pushToEmails(admin, recipients, {
    title,
    body: (row.summary || row.subject).slice(0, 180),
    url: update ? "/schedule" : "/",
    tag: row.id,
  }).catch(() => 0);

  return { students: subs.length, pushed };
}
