import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAskPrompt, parseAskReply, ASK_DAILY_LIMIT, type AskNotice } from "@/lib/ask";
import { buildWeek, type UserCourse } from "@/lib/timetable/slots";
import { cleanSubject } from "@/lib/display";

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Not configured." }, { status: 500 });

  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count } = await supabase.from("ask_log").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("asked_at", since);
  if ((count || 0) >= ASK_DAILY_LIMIT) return NextResponse.json({ error: `That's ${ASK_DAILY_LIMIT} questions today — try again tomorrow.` }, { status: 429 });
  await supabase.from("ask_log").insert({ user_id: user.id });

  const now = new Date();
  const [feed, courses, deadlines, files] = await Promise.all([
    supabase.rpc("me_feed", { p_since: new Date(now.getTime() - 30 * 86400_000).toISOString(), p_min_score: 3 }),
    supabase.from("user_courses").select("course_code, title, division, lecture_slots, tutorial_slots, venue"),
    supabase.from("moodle_deadlines").select("course_code, name, kind, due_at").gte("due_at", now.toISOString()).order("due_at").limit(40),
    supabase.from("course_files").select("course_code, name, module").order("modified_at", { ascending: false }).limit(150),
  ]);

  const notices: AskNotice[] = ((feed.data || []) as any[])
    .filter((i) => i.status !== "removed")
    .sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))
    .slice(0, 80)
    .map((i) => ({ id: i.id, subject: i.subject, summary: i.summary, body: i.body, sender: i.from_address, received_at: i.received_at, deadline_at: i.deadline_at }));
  const classes = buildWeek((courses.data || []) as UserCourse[], now).map((s) => ({ when: s.start_time, title: s.title, venue: s.location }));

  const prompt = buildAskPrompt(question, { now, notices, classes, deadlines: deadlines.data || [], files: files.data || [] });
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
  });
  if (!res.ok) return NextResponse.json({ error: "Couldn't answer right now. Try again in a minute." }, { status: 502 });
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const out = parseAskReply(text, notices);
  return NextResponse.json({ answer: out.answer, sources: out.sources.map((s) => ({ ...s, subject: cleanSubject(s.subject) })) });
}
