import type { SupabaseClient } from "@supabase/supabase-js";
import { processInbound } from "@/lib/server/ingestPipeline";
import { isUsefulCaption, parseBusinessDiscovery, postToEmail } from "@/lib/instagram";

const GRAPH = "https://graph.facebook.com/v21.0";

type Source = { id: number; handle: string; last_posted_at: string | null };

/**
 * Public posts of club / council accounts through Instagram's official Business Discovery API.
 * Needs a Campus Daily Instagram Business or Creator account (INSTAGRAM_USER_ID) and its long-lived
 * access token (INSTAGRAM_TOKEN). Only accounts that are themselves Business or Creator profiles can be read.
 */
export async function runInstagram(admin: SupabaseClient, deadline: number, batch = 12) {
  const token = process.env.INSTAGRAM_TOKEN;
  const me = process.env.INSTAGRAM_USER_ID;
  if (!token || !me) return { skipped: "INSTAGRAM_TOKEN / INSTAGRAM_USER_ID not set" };

  const { data } = await admin
    .from("instagram_sources")
    .select("id, handle, last_posted_at")
    .eq("enabled", true)
    .order("last_fetched_at", { ascending: true, nullsFirst: true })
    .limit(batch);
  const stats = { checked: 0, filed: 0, errors: 0 };
  for (const s of (data || []) as Source[]) {
    if (Date.now() > deadline) break;
    stats.checked++;
    const touch = (patch: Record<string, unknown>) => admin.from("instagram_sources").update({ last_fetched_at: new Date().toISOString(), ...patch }).eq("id", s.id);
    try {
      const fields = `business_discovery.username(${s.handle}){username,name,media.limit(12){id,caption,timestamp,permalink,media_type}}`;
      const res = await fetch(`${GRAPH}/${me}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(20000) });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error?.message || `HTTP ${res.status}`).slice(0, 180));
      const parsed = parseBusinessDiscovery(json);
      if (!parsed) throw new Error("no data (not a Business or Creator account?)");
      // First look at an account: only the last 3 weeks, so a new handle doesn't flood the feed.
      const cutoff = s.last_posted_at || new Date(Date.now() - 21 * 86400_000).toISOString();
      let filed = 0;
      let newest = s.last_posted_at;
      for (const p of parsed.posts.filter((x) => x.timestamp && x.timestamp > cutoff).reverse()) {
        if (p.timestamp && (!newest || p.timestamp > newest)) newest = p.timestamp;
        if (!isUsefulCaption(p.caption)) continue;
        const r = await processInbound(postToEmail(s.handle, parsed.name, p));
        if (r.status === 200 && r.body.id) filed++;
      }
      stats.filed += filed;
      await touch({ last_error: null, last_filed: filed, last_posted_at: newest });
    } catch (e) {
      stats.errors++;
      await touch({ last_error: (e instanceof Error ? e.message : "failed").slice(0, 200) });
    }
  }
  return stats;
}
