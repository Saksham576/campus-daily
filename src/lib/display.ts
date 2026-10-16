/** Presentation helpers: turn raw mail subjects and senders into clean titles and source labels. */

const LIST_TAGS: Record<string, string> = {
  "s.events": "Student Events",
  "student-notices": "Student Notices",
  bodhitree: "Bodhitree",
  ep2026: "Physics Dept",
  bt26: "B.Tech 2026",
  allplus: "All",
};

/** "[S.Events] Re: Fwd: Workshop | 16th Oct" → "Workshop | 16th Oct" */
export function cleanSubject(subject: string): string {
  let s = subject;
  // [WhatsApp · Group] prefix, mailing-list tags, Bodhitree forum tags
  s = s.replace(/^\s*(\[[^\]]{1,60}\]\s*)+/, "");
  // Moodle course prefix: "MA 105-2026-1-ALL: " / "ENT101-2026-1: "
  s = s.replace(/^\s*[A-Z]{2,4}\s?\d{3}[A-Z]?-\d{4}-\d(?:-[A-Z0-9]+)?:?\s*/, "");
  // Reply / forward noise and a stray "Subject:" from forwarded mails
  s = s.replace(/^\s*((re|fwd?|fw)\s*:\s*)+/i, "").replace(/^\s*subject:\s*/i, "");
  s = s.replace(/\s+/g, " ").trim();
  return s || subject.trim();
}

/** Display name from "Name <addr>" / "\"Name (via IITB Moodle)\" <addr>" / bare address. */
export function senderName(from?: string | null): string {
  if (!from) return "";
  if (from.startsWith("WhatsApp:")) return from.slice(9).trim();
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  let name = m ? m[1] : from;
  name = name.replace(/\s*\(via [^)]*\)\s*/i, "").trim();
  if (/^[^\s@]+@[^\s@]+$/.test(name)) {
    const local = name.split("@")[0].replace(/[._-]+/g, " ").trim();
    return local.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name;
}

/** Where a notice came from, as a short label: "Moodle · MA 105", "Hostel 16 · WhatsApp", "Student Events". */
export function sourceLabel(item: { subject: string; from_address?: string | null; source?: string | null }): string {
  const subj = item.subject || "";
  if (item.source === "whatsapp" || (item.from_address || "").startsWith("WhatsApp:")) {
    return `${senderName(item.from_address) || "WhatsApp"} · WhatsApp`;
  }
  const moodle = subj.match(/^\s*([A-Z]{2,4})\s?(\d{3}[A-Z]?)-\d{4}/);
  if (item.source === "moodle" || /moodle/i.test(item.from_address || "")) {
    return moodle ? `Moodle · ${moodle[1]} ${moodle[2]}` : "Moodle";
  }
  const bodhi = subj.match(/\[Forum - ([A-Z]{2,3})(\d{3})/);
  if (bodhi) return `Bodhitree · ${bodhi[1]} ${bodhi[2]}`;
  const tag = subj.match(/^\s*\[([^\]]+)\]/);
  if (tag) {
    const key = tag[1].toLowerCase();
    if (LIST_TAGS[key]) return LIST_TAGS[key];
  }
  return senderName(item.from_address);
}

/** Time-of-day greeting in IST. */
export function greeting(now = new Date()): string {
  const h = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }));
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
