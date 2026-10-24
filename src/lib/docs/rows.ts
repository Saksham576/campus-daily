/**
 * A student's own line in a class list, said in words. Seating plans, tutorial lists and exam-slot lists
 * come out of PDFs as bare lines ("48 H21 26B2477 Name D3 T8"); this keeps the facts a student needs
 * (course, what it is, date and time, room, seat) and drops the table plumbing.
 */
export type RowInput = { line: string; context?: string | null; columns?: string | null; docName?: string | null };
export type RowSummary = { headline: string; details: string[]; /** yyyy-mm-dd of the event the row is about, if it has one */ date?: string | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const clock = (h: number, m: number, mer?: string) => {
  let hh = h;
  if (mer === "pm" && hh < 12) hh += 12;
  if (mer === "am" && hh === 12) hh = 0;
  const suffix = hh >= 12 ? "pm" : "am";
  return `${hh % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${suffix}`;
};

/** "Date – 23-10-2026, Time : 05.15 pm to 6.45 pm" -> "Fri 23 Oct, 5:15 pm – 6:45 pm". */
export function whenFrom(text: string): string | null {
  const d = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (!d) return null;
  const date = new Date(Date.UTC(+d[3], +d[2] - 1, +d[1]));
  if (date.getUTCMonth() !== +d[2] - 1) return null;
  const day = `${WEEKDAYS[date.getUTCDay()]} ${+d[1]} ${MONTHS[+d[2] - 1]}`;
  const t = text.match(/(\d{1,2})[.:](\d{2})\s*(am|pm|hrs?)?\s*(?:to|-|–)\s*(\d{1,2})[.:](\d{2})\s*(am|pm|hrs?)?/i);
  if (!t) return day;
  const mer2 = /pm|am/i.test(t[6] || "") ? t[6].toLowerCase() : undefined;
  const mer1 = /pm|am/i.test(t[3] || "") ? t[3].toLowerCase() : mer2;
  return `${day}, ${clock(+t[1], +t[2], mer1)} – ${clock(+t[4], +t[5], mer2)}`;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** "LH 301 – MIDDLE ROW" -> "LH 301, middle row". */
const place = (s: string) => s.replace(/\s*[-–—]\s*/g, ", ").replace(/,\s*([A-Z ]+)$/, (_m, r: string) => ", " + r.toLowerCase());

/** First dd-mm-yyyy in the text as yyyy-mm-dd ("Date – 23-10-2026" -> "2026-10-23"). */
export function dateFrom(text: string): string | null {
  const d = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (!d) return null;
  const date = new Date(Date.UTC(+d[3], +d[2] - 1, +d[1]));
  return date.getUTCMonth() === +d[2] - 1 ? date.toISOString().slice(0, 10) : null;
}

export function summarizeRow(r: RowInput): RowSummary | null {
  const s = summarizeRowText(r);
  return s ? { ...s, date: dateFrom(r.context || "") } : s;
}

function summarizeRowText(r: RowInput): RowSummary | null {
  const ctx = (r.context || "").split(" · ").map((x) => x.trim()).filter(Boolean);
  const columns = (r.columns || "").toLowerCase();
  const course = (r.context || "").match(/\b([A-Z]{2,3})\s?(\d{3}[A-Z]?)\b/)?.[0]?.replace(/^([A-Z]+)(\d)/, "$1 $2") || (r.docName || "").match(/\b([A-Z]{2,3})\s?(\d{3}[A-Z]?)(?![A-Za-z0-9])/)?.[0]?.replace(/^([A-Z]+)(\d)/, "$1 $2") || null;
  const when = whenFrom(r.context || "");
  const division = (r.context || "").match(/\bdivision\s*[:–-]\s*([A-Z]?\d+[A-Z]?)\b/i)?.[1]?.toUpperCase() || null;
  // What it is: the first title-like line ("Quiz 2", "Mid Sem", "End semester exam time table").
  const what = ctx.find((c) => /\b(quiz|mid\s?-?sem|end\s?-?sem|exam|test|lab|viva|tutorial|allotment|group)\b/i.test(c) && c.length <= 60 && !/institute|technology/i.test(c));
  const room = ctx.find((c) => /\b(?:LA|LC|LH|LT|CC|SIC|MB|KR|VMCC)[- ]?\d{1,3}\b|\b(?:row|hall|room)\b/i.test(c) && c.length <= 60);

  if (/seat/.test(columns) || /\bseat/i.test(r.docName || "")) {
    const seat = r.line.match(/(?:^|\s)([A-Z]{1,2}\d{1,3})(?=\s)/)?.[1];
    if (seat) {
      const tut = r.line.match(/\b(D\d)\s*\/?\s*(T\d+)\b/);
      const head = [course, what ? titleCase(what.replace(/\s+/g, " ")) : "Seat"].filter(Boolean).join(" ");
      return {
        headline: `${head}: seat ${seat}${room ? `, ${place(room)}` : ""}`,
        details: [when, tut ? `${tut[1]}, tutorial ${tut[2]}` : null].filter(Boolean) as string[],
      };
    }
  }
  if (/tutorial|section/.test(columns)) {
    const m = r.line.match(/\b(D\d)\s*\/?\s*(T\d+)\b/);
    if (m) {
      const classroom = r.line.match(/\b((?:LT|LH|LA|LC|CC|SIC|MB)[- ]?\d{1,3})\b/i)?.[1]?.toUpperCase().replace(/^([A-Z]+)-?(\d)/, "$1 $2");
      return { headline: `${course || "Your"} class list: division ${m[1]}, tutorial batch ${m[2]}`, details: classroom ? [`Tutorial classroom ${classroom}`] : [] };
    }
  }
  if (/batch|group/.test(columns)) {
    const m = r.line.match(/\b(P\d+)\b(?:\s+(\w+))?\s*$/);
    if (m) return { headline: `Lab batch ${m[1]}${m[2] ? `, group ${m[2]}` : ""}`, details: [] };
  }
  if (/event/.test(columns)) {
    const last = r.line.split(/\s+/).slice(-1)[0];
    if (last && !/^\d/.test(last)) return { headline: `Your allotment: ${last}`, details: [] };
  }
  if (when) return { headline: [course, what ? titleCase(what) : null].filter(Boolean).join(" ") || "Your slot", details: [when, division ? `Division ${division}` : null, room ? place(room) : null].filter(Boolean) as string[] };
  return null;
}
