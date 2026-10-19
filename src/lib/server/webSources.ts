import type { SupabaseClient } from "@supabase/supabase-js";
import { geminiJson } from "@/lib/server/gemini";
import { processInbound } from "@/lib/server/ingestPipeline";
import { buildExtractPrompt, htmlToText, pageHash, parseWebItems, webItemToEmail } from "@/lib/webPages";

type Source = { id: number; name: string; url: string; last_hash: string | null };

/** Read the next few public pages that are due; file anything new through the normal notice pipeline. */
export async function runWebSources(admin: SupabaseClient, deadline: number, batch = 4) {
  const { data } = await admin
    .from("web_sources")
    .select("id, name, url, last_hash")
    .eq("enabled", true)
    .order("last_fetched_at", { ascending: true, nullsFirst: true })
    .limit(batch);
  const stats = { checked: 0, changed: 0, filed: 0, errors: 0 };
  for (const s of (data || []) as Source[]) {
    if (Date.now() > deadline) break;
    stats.checked++;
    const touch = (patch: Record<string, unknown>) => admin.from("web_sources").update({ last_fetched_at: new Date().toISOString(), ...patch }).eq("id", s.id);
    try {
      const res = await fetch(s.url, { headers: { "user-agent": "CampusDailyBot/1.0 (+https://campusdaily.nexuspulsetech.com)" }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = htmlToText(await res.text(), s.url);
      if (text.length < 200) throw new Error("page has no readable text");
      const hash = pageHash(text);
      if (hash === s.last_hash) {
        await touch({ last_error: null });
        continue;
      }
      stats.changed++;
      const g = await geminiJson(buildExtractPrompt(s.name, s.url, text), { temperature: 0 });
      if (!g.ok) throw new Error(`reading failed (${g.detail.slice(0, 80)})`);
      const items = parseWebItems(g.text);
      let filed = 0;
      for (const it of items) {
        const email = webItemToEmail(s.name, s.url, it);
        // Already filed in an earlier run (same page, same headline).
        const { count } = await admin.from("items").select("id", { count: "exact", head: true }).eq("sender", email.from).eq("subject", email.subject.slice(0, 500));
        if (count) continue;
        const r = await processInbound(email);
        if (r.status === 200 && r.body.id) filed++;
      }
      stats.filed += filed;
      await touch({ last_hash: hash, last_error: null, last_filed: filed });
    } catch (e) {
      stats.errors++;
      await touch({ last_error: (e instanceof Error ? e.message : "failed").slice(0, 200) });
    }
  }
  return stats;
}
