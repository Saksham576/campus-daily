import { NextResponse, type NextRequest } from "next/server";
import { geminiJson } from "@/lib/server/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/cron/ask-health (Bearer CRON_SECRET) — health check: a tiny and a large Gemini call, statuses only. */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const small = await geminiJson('Reply as JSON: {"answer":"ok"}');
  const big = await geminiJson('Reply as JSON: {"answer":"ok"}\n' + "Notice text. ".repeat(6000));
  const view = (r: Awaited<ReturnType<typeof geminiJson>>) => (r.ok ? { ok: true } : { ok: false, status: r.status, detail: r.detail.slice(0, 200) });
  return NextResponse.json({ model: process.env.GEMINI_MODEL || "default", small: view(small), big: view(big) });
}
