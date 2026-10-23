import type { InboundEmail } from "./ingest.ts";

export type IgPost = { id?: string; caption?: string | null; timestamp?: string | null; permalink?: string | null; media_type?: string | null };

/** Business Discovery reply -> the account's recent public posts (newest first). */
export function parseBusinessDiscovery(json: any): { name: string; posts: IgPost[] } | null {
  const bd = json?.business_discovery;
  if (!bd) return null;
  const posts: IgPost[] = Array.isArray(bd.media?.data) ? bd.media.data : [];
  return { name: String(bd.name || bd.username || ""), posts: [...posts].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))) };
}

/** Posts with no real caption (a photo dump, a lone emoji) say nothing we can use. */
export const isUsefulCaption = (c?: string | null) => Boolean(c) && c!.replace(/[#@]\S+|[^\p{L}\p{N}\s]/gu, "").trim().length >= 25;

/** An Instagram caption as a notice: first line is the headline, the rest the body, link last. */
export function postToEmail(handle: string, accountName: string, p: IgPost): InboundEmail {
  const caption = (p.caption || "").trim();
  const firstLine = caption.split("\n").find((l) => l.replace(/[^\p{L}\p{N}]/gu, "").length >= 6) || caption;
  const subject = firstLine.replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+/u, "").slice(0, 140) || `Post by @${handle}`;
  return {
    messageId: `ig:${p.id || p.permalink || p.timestamp}`,
    subject,
    from: `Instagram: @${handle}`,
    date: p.timestamp || new Date().toISOString(),
    body: `${accountName ? accountName + " (@" + handle + ") on Instagram\n\n" : ""}${caption}\n\n${p.permalink || ""}`.trim(),
  };
}

export const normaliseHandle = (h: string) => h.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").toLowerCase();
