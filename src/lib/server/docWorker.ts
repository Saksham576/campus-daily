import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/server/crypto";
import { withToken } from "@/lib/moodle";
import { chunkPages, docKind, extractText, looksScanned, rosterHeader, rosterRows, MAX_DOC_BYTES, type Page } from "@/lib/docs/extract";

export const docId = (prefix: "mdl" | "att", key: string) => `${prefix}_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;

const MAX_AI_PER_RUN = 2;
const AI_MAX_BYTES = 15 * 1024 * 1024;

type Doc = {
  id: string;
  source: string;
  course_id: number | null;
  name: string;
  mime: string | null;
  file_url: string | null;
  storage_path: string | null;
  tries: number;
};

/** A connected student's Moodle key for a course (any classmate's works — course files are shared). */
async function tokenFor(admin: SupabaseClient, courseId: number, cache: Map<number, string | null>): Promise<string | null> {
  if (cache.has(courseId)) return cache.get(courseId)!;
  const { data: enr } = await admin.from("moodle_enrolments").select("user_id").eq("course_id", courseId).limit(50);
  const ids = (enr || []).map((r) => r.user_id);
  let token: string | null = null;
  if (ids.length) {
    const { data: conns } = await admin.from("moodle_connections").select("token_enc").in("user_id", ids).is("last_error", null).limit(1);
    try {
      token = conns?.[0] ? decryptSecret(conns[0].token_enc) : null;
    } catch {
      token = null;
    }
  }
  cache.set(courseId, token);
  return token;
}

async function bytesOf(admin: SupabaseClient, d: Doc, tokens: Map<number, string | null>): Promise<Uint8Array> {
  if (d.storage_path) {
    const { data, error } = await admin.storage.from("attachments").download(d.storage_path);
    if (error || !data) throw new Error("attachment missing");
    return new Uint8Array(await data.arrayBuffer());
  }
  if (!d.file_url || !d.course_id) throw new Error("no source");
  const token = await tokenFor(admin, d.course_id, tokens);
  if (!token) throw new Error("no Moodle key for this course yet");
  const res = await fetch(withToken(d.file_url, token));
  if (!res.ok) throw new Error(`download ${res.status}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_DOC_BYTES) throw new Error("too large");
  return new Uint8Array(await res.arrayBuffer());
}

/** Scanned PDFs: ask the AI to transcribe them (a couple per run). */
async function transcribe(buf: Uint8Array, name: string): Promise<Page[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || buf.byteLength > AI_MAX_BYTES) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: "application/pdf", data: Buffer.from(buf).toString("base64") } },
            {
              text:
                `Transcribe the text of "${name}" exactly, page by page (tables as tab-separated rows, one row per line). ` +
                `Reply as JSON {"pages":[{"page":1,"text":"..."}]}. Only the document's text — no commentary.`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });
  if (!res.ok) return null;
  const j: any = await res.json().catch(() => null);
  try {
    const parsed = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    const pages = (parsed.pages || []).filter((p: any) => typeof p?.text === "string").map((p: any, i: number) => ({ page: Number(p.page) || i + 1, text: String(p.text) }));
    return pages.length ? pages : null;
  } catch {
    return null;
  }
}

/** Read pending documents until the deadline. Newest first, so fresh files are searchable quickly. */
export async function processDocs(admin: SupabaseClient, deadlineMs: number) {
  const stats = { done: 0, roster: 0, ai: 0, skipped: 0, failed: 0 };
  const { data } = await admin
    .from("documents")
    .select("id, source, course_id, name, mime, file_url, storage_path, tries")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(40);
  const tokens = new Map<number, string | null>();

  for (const d of (data || []) as Doc[]) {
    if (Date.now() > deadlineMs) break;
    try {
      if (!docKind(d.name, d.mime)) {
        await admin.from("documents").update({ status: "skipped", processed_at: new Date().toISOString() }).eq("id", d.id);
        stats.skipped++;
        continue;
      }
      const buf = await bytesOf(admin, d, tokens);
      let ex = await extractText(buf, d.name, d.mime);
      let method = "text";
      if (ex && looksScanned(ex) && stats.ai < MAX_AI_PER_RUN) {
        const pages = await transcribe(buf, d.name);
        stats.ai++;
        if (pages) {
          ex = { kind: ex.kind, pages };
          method = "ai";
        }
      }
      if (!ex) {
        await admin.from("documents").update({ status: "skipped", error: "unreadable", processed_at: new Date().toISOString() }).eq("id", d.id);
        stats.skipped++;
        continue;
      }

      // Class lists: keep only each student's own lines, plus the header.
      const roster = rosterRows(ex.pages);
      const chunks = chunkPages(roster ? rosterHeader(ex.pages) : ex.pages);
      await admin.from("doc_chunks").delete().eq("doc_id", d.id);
      await admin.from("personal_rows").delete().eq("doc_id", d.id);
      for (let i = 0; i < chunks.length; i += 200) {
        const { error } = await admin.from("doc_chunks").insert(chunks.slice(i, i + 200).map((c) => ({ doc_id: d.id, ...c })));
        if (error) throw new Error(`chunks: ${error.message}`);
      }
      if (roster) {
        for (let i = 0; i < roster.length; i += 500) {
          await admin.from("personal_rows").insert(roster.slice(i, i + 500).map((r) => ({ doc_id: d.id, ...r })));
        }
        stats.roster++;
      }
      await admin
        .from("documents")
        .update({
          status: "done",
          method,
          is_roster: Boolean(roster),
          pages: ex.pages.length,
          chars: ex.pages.reduce((n, p) => n + p.text.length, 0),
          error: null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", d.id);
      stats.done++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      const giveUp = d.tries + 1 >= 3 || msg === "too large";
      await admin
        .from("documents")
        .update({ status: giveUp ? "failed" : "pending", tries: d.tries + 1, error: msg.slice(0, 200) })
        .eq("id", d.id);
      stats.failed++;
    }
  }
  return stats;
}
