import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAskPrompt, parseAskReply, ASK_DAILY_LIMIT, type AskNotice } from "@/lib/ask";
import { buildWeek, type UserCourse } from "@/lib/timetable/slots";
import { cleanSubject } from "@/lib/display";
import { geminiJson } from "@/lib/server/gemini";
import { validateAction, describeAction } from "@/lib/actions";

export const runtime = "nodejs";
export const maxDuration = 30;

/** POST /api/ask {q} — answers from the signed-in student's own notices, timetable and Moodle (RLS-scoped). */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { q } = await req.json().catch(() => ({ q: "" }));
  const question = String(q || "").trim();
  if (question.length < 3) return NextResponse.json({ error: "Ask a question." }, { status: 400 });


  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count } = await supabase.from("ask_log").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("asked_at", since);
  if ((count || 0) >= ASK_DAILY_LIMIT) return NextResponse.json({ error: `That's ${ASK_DAILY_LIMIT} questions today — try again tomorrow.` }, { status: 429 });
  await supabase.from("ask_log").insert({ user_id: user.id });

  const now = new Date();
  const [feed, courses, deadlines, files, profile, evs] = await Promise.all([
    supabase.rpc("me_feed", { p_since: new Date(now.getTime() - 30 * 86400_000).toISOString(), p_min_score: 3 }),
    supabase.from("user_courses").select("course_code, title, division, lecture_slots, tutorial_slots, venue"),
    supabase.from("moodle_deadlines").select("course_code, name, kind, due_at").gte("due_at", now.toISOString()).order("due_at").limit(40),
    supabase.from("course_files").select("course_code, name, module").order("modified_at", { ascending: false }).limit(150),
    supabase.from("subscribers").select("digest, muted_senders, keywords, categories").eq("email", (user.email || "").toLowerCase()).maybeSingle(),
    supabase.from("events").select("title, course_code, start_at, venue, cancelled, resolved").gte("on_date", new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)).order("on_date").limit(40),
  ]);
  const events = ((evs.data || []) as any[]).map((e) => ({
    title: cleanSubject(e.title),
    course_code: e.course_code,
    start: e.start_at,
    venue: e.venue,
    cancelled: e.cancelled,
    sources: [...new Set(((e.resolved?.sources || []) as any[]).map((x) => x.source))].join(", ") || "notice",
    conflicts: ((e.resolved?.conflicts || []) as any[]).map((c) => `${c.source}: ${c.value}`).join("; "),
  }));
  const settings = {
    digest: profile.data?.digest,
    muted: (profile.data?.muted_senders || []) as string[],
    keywords: profile.data?.keywords,
    categories: (profile.data?.categories || []) as string[],
  };

  const notices: AskNotice[] = ((feed.data || []) as any[])
    .filter((i) => i.status !== "removed")
    .sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))
    .slice(0, 80)
    .map((i) => ({ id: i.id, subject: i.subject, summary: i.summary, body: i.body, sender: i.from_address, received_at: i.received_at, deadline_at: i.deadline_at }));
  const realNotices = notices.length;

  // Inside documents: best-matching passages from files the student can see, and their own rows in
  // class lists (mess dues, marks, seating). Added as extra numbered entries so answers can cite them.
  const [docHits, ownRows] = await Promise.all([
    supabase.rpc("search_docs", { q: question, lim: 6, mode: "any" }),
    supabase.from("personal_rows").select("doc_id, page, line, context, columns").limit(40),
  ]);
  for (const h of (docHits.data || []) as any[]) {
    notices.push({ id: `doc:${h.doc_id}:${h.page}`, subject: `File: ${h.name}${h.course_code ? ` (${h.course_code})` : ""}, page ${h.page}`, body: String(h.content).slice(0, 1500) });
  }
  if (ownRows.data?.length) {
    const ids = [...new Set(ownRows.data.map((r) => r.doc_id))];
    const { data: names } = await supabase.from("documents").select("id, name").in("id", ids);
    const nameOf = new Map((names || []).map((d) => [d.id, d.name]));
    for (const r of ownRows.data) {
      notices.push({ id: `row:${r.doc_id}:${r.page}`, subject: `Your row in “${nameOf.get(r.doc_id) || "a class list"}”`, body: [r.context ? `About this list: ${r.context}` : "", r.columns ? `Columns: ${r.columns}` : "", `Your row: ${r.line}`].filter(Boolean).join("\n") });
    }
  }

  const classes = buildWeek((courses.data || []) as UserCourse[], now).map((s) => ({ when: s.start_time, title: s.title, venue: s.location }));

  const prompt = buildAskPrompt(question, { now, notices, classes, deadlines: deadlines.data || [], files: files.data || [], settings, events });
  const g = await geminiJson(prompt);
  if (!g.ok) {
    const busy = g.status === 429 || g.status === 503;
    return NextResponse.json({ error: busy ? "The AI is busy right now — try again in a minute." : "Couldn't answer that one. Try rephrasing." }, { status: 502 });
  }
  const text = g.text;
  const out = parseAskReply(text, notices);
  const ctx = { noticeIds: notices.slice(0, realNotices).map((n) => n.id), senders: notices.map((n) => n.sender || "").filter(Boolean), muted: settings.muted };
  const title = (id: string) => cleanSubject(notices.find((n) => n.id === id)?.subject || "");
  const actions = out.actions
    .map((a) => validateAction(a, ctx))
    .filter(Boolean)
    .map((a) => ({ action: a!, label: describeAction(a!, title) }));
  return NextResponse.json({ answer: out.answer, sources: out.sources.map((s) => ({ ...s, subject: cleanSubject(s.subject) })), actions });
}

