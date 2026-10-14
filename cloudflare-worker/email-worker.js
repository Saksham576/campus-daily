/**
 * Cloudflare Email Worker for ingest@campusdaily.nexuspulsetech.com
 *
 * Setup:
 *  1. Cloudflare dashboard -> Email Routing -> enable for the domain.
 *  2. Create this Worker; set secrets:  INGEST_URL (e.g. https://campusdaily.nexuspulsetech.com/api/ingest/email)
 *     and INGEST_SECRET_KEY (same value as the Vercel env var).
 *  3. Email Routing -> Routes: ingest@ -> "Send to a Worker" -> this Worker.
 *  4. Subscribe the ingest address to the IITB mailing lists (or have volunteers forward to it).
 *
 * Throwing makes Cloudflare bounce/retry the message instead of silently dropping it.
 */
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).text();
    const body = extractBody(raw);
    const res = await fetch(env.INGEST_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ingest-secret": env.INGEST_SECRET_KEY },
      body: JSON.stringify({
        messageId: message.headers.get("message-id") || undefined,
        subject: decodeHeader(message.headers.get("subject") || ""),
        from: message.headers.get("from") || message.from,
        date: message.headers.get("date") || undefined,
        text: body,
      }),
    });
    if (!res.ok && res.status !== 422) throw new Error(`ingest failed: ${res.status}`);
  },
};

// Minimal MIME handling: prefer text/plain, fall back to the raw body (server strips HTML).
function extractBody(raw) {
  const split = raw.search(/\r?\n\r?\n/);
  const content = split >= 0 ? raw.slice(split).trim() : raw;
  const boundary = (raw.match(/boundary="?([^"\r\n;]+)"?/i) || [])[1];
  if (!boundary) return content;
  const parts = content.split("--" + boundary);
  const plain = parts.find((p) => /content-type:\s*text\/plain/i.test(p)) || parts.find((p) => /content-type:\s*text\/html/i.test(p));
  return plain ? plain.slice(plain.search(/\r?\n\r?\n/)).trim() : content;
}

function decodeHeader(v) {
  return v.replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, enc, data) => {
    try {
      if (enc.toLowerCase() === "b") return new TextDecoder().decode(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
      return decodeURIComponent(data.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, "%$1"));
    } catch {
      return data;
    }
  });
}
