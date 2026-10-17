/**
 * Webmail forwarding: every student gets a private forwarding address
 * (campusdaily.inbox+<token>@gmail.com). The "+token" tells us whose inbox a mail came from;
 * mail addressed to that student (not a mailing list) stays visible to them alone.
 */
export const INGEST_INBOX = "campusdaily.inbox@gmail.com";

export function forwardAddress(token: string): string {
  const [user, domain] = INGEST_INBOX.split("@");
  return `${user}+${token}@${domain}`;
}

// Old address (campusdaily.ingest) still recognised for students who set up forwarding before the move.
const TOKEN_RE = /campusdaily\.(?:inbox|ingest)\+([a-z0-9]{6,16})@gmail\.com/i;

/** The forwarding token in Delivered-To / To / Cc, if any. */
export function forwardToken(h: { deliveredTo?: string; to?: string; cc?: string }): string | null {
  for (const v of [h.deliveredTo, h.to, h.cc]) {
    const m = (v || "").match(TOKEN_RE);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

export function newForwardToken(rand: () => number = Math.random): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => abc[Math.floor(rand() * abc.length)]).join("");
}

/**
 * Personal = sent to this student directly (their address in To/Cc) rather than through a mailing list
 * (List-Id header), or flagged as addressed to one individual by the scorer.
 */
export function isPersonalMail(h: { listId?: string; to?: string; cc?: string }, ownerEmail: string, scoredPersonal = false): boolean {
  if (scoredPersonal) return true;
  if ((h.listId || "").trim()) return false;
  const owner = ownerEmail.trim().toLowerCase();
  return `${h.to || ""},${h.cc || ""}`.toLowerCase().includes(owner);
}
