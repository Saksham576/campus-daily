import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseUpdate } from "@/lib/timetable/updates";
import { takesCourse } from "@/lib/timetable/courses";
import { pushToEmails } from "@/lib/server/push";

export type Sub = {
  email: string;
  department: string | null;
  year: string | null;
  hostel: string | null;
  division: string | null;
  hasmed: string | null;
  keywords: string | null;
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
  update: CourseUpdate | null
) {
  const { error } = await admin.from("items").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`items upsert: ${error.message}`);

  const { data, error: subErr } = await admin
    .from("subscribers")
    .select("email, department, year, hostel, division, hasmed, keywords")
    .is("merged_into", null);
  if (subErr) console.error("publish: subscribers read failed", subErr.message);
  const subs = (data || []) as Sub[];

  const scores = subs.map((s) => ({ sub: s, score: scoreFor(s) }));
  if (scores.length > 0) {
    const { error: uiErr } = await admin.from("user_items").upsert(
      scores.map(({ sub, score }) => ({ email: sub.email, item_id: row.id, score, state: "new", scored_by: "ingest" })),
      { onConflict: "email,item_id", ignoreDuplicates: true }
    );
    if (uiErr) console.error("publish: user_items upsert failed", uiErr.message);
  }

  if (update) {
    const { error: upErr } = await admin.from("course_updates").upsert(update, { onConflict: "notice_id" });
    if (upErr) console.error("publish: course update failed", upErr.message);
  }

  // Push: timetable changes go to students taking the course; other notices only if urgent.
  const recipients =
    update && update.kind !== "added"
      ? subs.filter((s) => takesCourse(s, update.course_code)).map((s) => s.email)
      : scores.filter((x) => x.score >= URGENT_SCORE).map((x) => x.sub.email);
  const title =
    update?.kind === "cancelled"
      ? `${update.course_code} cancelled`
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
