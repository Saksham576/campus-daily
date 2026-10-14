/** Skip chit-chat: only forward messages long enough to be a notice. */
export function isRelevant(body) {
  if (typeof body !== "string") return false;
  const text = body.trim();
  if (text.length < 40) return false;
  if (/^(ok|okay|thanks|thank you|noted|👍)/i.test(text) && text.length < 80) return false;
  return true;
}

/** Shape a WhatsApp group message like an inbound email for /api/ingest/email. */
export function toIngestPayload({ id, group, author, body, timestamp }) {
  const firstLine = body.trim().split("\n")[0].replace(/[*_~]/g, "").trim();
  const subject = firstLine.length > 90 ? firstLine.slice(0, 87) + "…" : firstLine;
  return {
    messageId: `wa:${id}`,
    subject: `[WhatsApp · ${group}] ${subject}`,
    from: `WhatsApp: ${group} (${author})`,
    date: new Date((timestamp || Date.now() / 1000) * 1000).toISOString(),
    text: body.trim(),
  };
}
