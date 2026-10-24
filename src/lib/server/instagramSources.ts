import type { SupabaseClient } from "@supabase/supabase-js";
import { processInbound } from "@/lib/server/ingestPipeline";
import { isUsefulCaption, parseBusinessDiscovery, postToEmail } from "@/lib/instagram";

const GRAPH = "https://graph.facebook.com/v21.0";

export type IgSource = { id: number; handle: string; last_posted_at: string | null; owner_email?: string | null };

/** Read one account's recent posts and file the new ones (for everyone, or for the student who follows it). */
export async function readSource(admin: SupabaseClient, s: IgSource, token: string, me: string): Promise<{ filed: number }> {
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
      const mail = postToEmail(s.handle, parsed.name, p);
      const r = await processInbound(s.owner_email ? { ...mail, owner: s.owner_email } : mail);
      if (r.status === 200 && r.body.id) filed++;
    }
    await touch({ last_error: null, last_filed: filed, last_posted_at: newest });
    return { filed };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : "failed").slice(0, 200);
    // Throttled by Meta: keep its place in the queue so it is first in line next run instead of waiting its whole turn again.
    if (/blocked|rate limit|too many calls|request limit/i.test(msg)) await admin.from("instagram_sources").update({ last_error: msg }).eq("id", s.id);
    else await touch({ last_error: msg });
    throw e;
  }
}

/**
 * Public posts of club / council accounts through Instagram's official Business Discovery API.
 * Needs a Campus Daily Instagram Business or Creator account (INSTAGRAM_USER_ID) and its long-lived
 * access token (INSTAGRAM_TOKEN). Only accounts that are themselves Business or Creator profiles can be read.
 */
/** The institute's own big-event accounts: read on every run so Insti Nite or a convocation is never hours late. */
const PRIORITY_HANDLES = ["iitbombay.moodi", "techfest_iitbombay", "culturals.iitb", "tech.iitb", "pro.iitbombay", "iitbombaysports"];

export async function runInstagram(admin: SupabaseClient, deadline: number, batch = 8) {
  const token = process.env.INSTAGRAM_TOKEN;
  const me = process.env.INSTAGRAM_USER_ID;
  if (!token || !me) return { skipped: "INSTAGRAM_TOKEN / INSTAGRAM_USER_ID not set" };

  const cols = "id, handle, last_posted_at, owner_email";
  const [priority, rotation] = await Promise.all([
    admin.from("instagram_sources").select(cols).eq("enabled", true).in("handle", PRIORITY_HANDLES).is("owner_email", null),
    admin.from("instagram_sources").select(cols).eq("enabled", true).not("handle", "in", "(" + PRIORITY_HANDLES.join(",") + ")").order("last_fetched_at", { ascending: true, nullsFirst: true }).limit(batch),
  ]);
  const queue = [...((priority.data || []) as IgSource[]), ...((rotation.data || []) as IgSource[])];
  const stats = { checked: 0, filed: 0, errors: 0, blocked: 0 };
  for (const s of queue) {
    if (Date.now() > deadline) break;
    stats.checked++;
    try {
      const r = await readSource(admin, s, token, me);
      stats.filed += r.filed;
      stats.blocked = 0;
    } catch (e) {
      stats.errors++;
      // "API access blocked" means Meta is throttling the app: more calls only make it worse, so wait for the next run.
      if (/blocked|rate limit|too many calls|request limit/i.test(e instanceof Error ? e.message : "") && ++stats.blocked >= 3) break;
    }
  }
  return stats;
}
