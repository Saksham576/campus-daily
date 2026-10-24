/**
 * Text out of course documents: PDF (unpdf/pdf.js), Word / PowerPoint / Excel (they are zip files of XML),
 * and plain text. Scanned PDFs come back nearly empty — the worker can send those to the AI instead.
 */
import { unzipSync, strFromU8 } from "fflate";

export type Page = { page: number; text: string };
export type Extracted = { pages: Page[]; kind: string };

export const MAX_DOC_BYTES = 25 * 1024 * 1024;

export function docKind(name: string, mime?: string | null): string | null {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  // Some Moodle files have no extension in their name ("CH 111 D3 tutorial batches"); the mime type still says what they are.
  if (n.endsWith(".docx") || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (n.endsWith(".pptx") || mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (n.endsWith(".xlsx") || mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (/\.(txt|csv|md|tsv)$/.test(n) || mime?.startsWith("text/")) return "text";
  return null;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, "&");

/** Text runs of an Office XML part, with paragraph / row breaks kept as newlines. */
function xmlText(xml: string, tag: "w:t" | "a:t" | "t"): string {
  const breaks = xml.replace(/<\/(w:p|a:p|row)>/g, "\n").replace(/<(w:tab|w:br)\/>/g, " ");
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>|\\n`, "g");
  let out = "";
  for (const m of breaks.matchAll(re)) out += m[1] !== undefined ? decode(m[1]) + (tag === "t" ? "\t" : "") : "\n";
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function officePages(buf: Uint8Array, kind: "docx" | "pptx" | "xlsx"): Page[] {
  const files = unzipSync(buf, {
    filter: (f) =>
      kind === "docx"
        ? f.name === "word/document.xml"
        : kind === "pptx"
          ? /^ppt\/slides\/slide\d+\.xml$/.test(f.name)
          : f.name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name),
  });
  if (kind === "docx") return [{ page: 1, text: xmlText(strFromU8(files["word/document.xml"] || new Uint8Array()), "w:t") }];
  if (kind === "pptx") {
    return Object.keys(files)
      .map((k) => ({ page: +k.match(/slide(\d+)\.xml$/)![1], text: xmlText(strFromU8(files[k]), "a:t") }))
      .sort((a, b) => a.page - b.page);
  }
  // xlsx: shared strings in order, then each sheet's cells (strings by index, numbers inline)
  const shared = [...strFromU8(files["xl/sharedStrings.xml"] || new Uint8Array()).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join("")
  );
  return Object.keys(files)
    .filter((k) => k.startsWith("xl/worksheets/"))
    .map((k) => {
      const xml = strFromU8(files[k]);
      const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
        [...r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)]
          .map((c) => {
            const v = c[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? c[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
            return /t="s"/.test(c[1]) ? shared[+v] ?? "" : decode(v);
          })
          .join("\t")
      );
      return { page: +(k.match(/sheet(\d+)\.xml$/)?.[1] || 1), text: rows.join("\n").trim() };
    })
    .sort((a, b) => a.page - b.page);
}

export async function extractText(buf: Uint8Array, name: string, mime?: string | null): Promise<Extracted | null> {
  const kind = docKind(name, mime);
  if (!kind || buf.byteLength > MAX_DOC_BYTES) return null;
  if (kind === "text") return { kind, pages: [{ page: 1, text: new TextDecoder().decode(buf).slice(0, 400_000) }] };
  if (kind === "pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: false });
    return { kind, pages: (text as string[]).map((t, i) => ({ page: i + 1, text: t.replace(/[ \t]+/g, " ").trim() })) };
  }
  return { kind, pages: officePages(buf, kind as "docx" | "pptx" | "xlsx") };
}

/** True when a PDF yields almost no text for its size — probably a scan. */
export function looksScanned(ex: Extracted): boolean {
  if (ex.kind !== "pdf") return false;
  const chars = ex.pages.reduce((n, p) => n + p.text.length, 0);
  return chars < 40 * Math.max(1, ex.pages.length);
}

// ---------- chunks & class lists ----------

export type Chunk = { idx: number; page: number; content: string };

/** ~1,200-character chunks that never span pages (so answers can cite a page). */
export function chunkPages(pages: Page[], size = 1200): Chunk[] {
  const out: Chunk[] = [];
  for (const p of pages) {
    const paras = p.text.split(/\n{2,}|\n(?=\S)/).map((x) => x.trim()).filter(Boolean);
    let cur = "";
    for (const para of paras) {
      if (cur && cur.length + para.length + 1 > size) {
        out.push({ idx: out.length, page: p.page, content: cur });
        cur = "";
      }
      cur = cur ? `${cur}\n${para}` : para.slice(0, size * 2);
    }
    if (cur) out.push({ idx: out.length, page: p.page, content: cur });
  }
  return out;
}

/** IITB roll numbers: 26b2477, 23D0123, 210100045. */
const ROLL_RE = /\b(\d{2}[a-z]\d{4,6}|\d{9})\b/gi;

/**
 * Lists with many students' rows (mess dues, marks, seating) are never stored whole: each student
 * only ever sees the lines with their own roll number. Each row keeps what a bare line loses:
 * the document title (course, date, time), the section it sits under (room, row, batch) and the
 * column names, so "10 J11 26b2477 … D1 T3" reads as "LA 001 – Left row, seat J11". Null for normal documents.
 */
export type RosterRow = { roll: string; page: number; line: string; context: string | null; columns: string | null };

const HEADING_RE = /(?:\b(?:LA|LC|LH|LT|CC|SIC|MB|VMCC)[- ]?\d{1,3}\b|\b(?:row|hall|room|block|lab|venue|section|batch|group|sub-?group|slot|shift|session|floor|wing)\b)/i;
const COLUMNS_RE = /\b(roll|seat|name|sr\.?\s*no|s\.?\s*no|division|batch|marks|amount)\b.*\b(roll|seat|name|sr\.?\s*no|s\.?\s*no|division|batch|marks|amount)\b/i;

export function rosterRows(pages: Page[]): RosterRow[] | null {
  const lines = pages.flatMap((p) => p.text.split("\n").map((line) => ({ page: p.page, line: line.trim() })));
  const rolls = new Set<string>();
  for (const l of lines) for (const m of l.line.matchAll(ROLL_RE)) rolls.add(m[1].toLowerCase());
  if (rolls.size < 8) return null;

  const hasRoll = (t: string) => new RegExp(ROLL_RE.source, "i").test(t);
  // Title: the lines before the first student row (course, date, time), minus the column header.
  const firstRow = lines.findIndex((l) => hasRoll(l.line));
  // Never let anything that looks like a student's table row into the shared title text.
  const looksLikeRow = (t: string) => /^\d+\s+[A-Z]\d{1,3}\s/.test(t) || /\b[DP]\d\s*\/?\s*T?\d+\s*$/.test(t) || (/^\d+\s/.test(t) && t.split(/\s+/).length >= 4 && !/[:–-]/.test(t));
  const head = lines.slice(0, Math.max(0, firstRow)).map((l) => l.line).filter((t) => t && !looksLikeRow(t));
  const columns = head.filter((t) => COLUMNS_RE.test(t)).pop() ?? null;
  // Lines that say which group a block of rows belongs to ("Division : P19", "Date : Monday, 26/10/2026", "Time : …").
  // Slot lists repeat them for every division, so the nearest block above a row is the one that applies to it.
  const BLOCK_RE = /\b(?:division|date|time|slot|shift)\s*[:–-]|\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b|\b\d{1,2}[.:]\d{2}\s*(?:am|pm)\b/i;
  const isBlockLine = (t: string) => t.length <= 120 && BLOCK_RE.test(t) && !COLUMNS_RE.test(t);
  const title = head.filter((t) => t !== columns && !HEADING_RE.test(t) && !isBlockLine(t) && t.length > 2).join(" · ").replace(/\s+/g, " ").slice(0, 200) || null;
  const titleHasSection = head.filter((t) => t !== columns && HEADING_RE.test(t) && t.length <= 80).pop() ?? null;

  const rows: RosterRow[] = [];
  let section: string | null = titleHasSection;
  let block: string[] = head.filter((t) => t !== columns && isBlockLine(t));
  let afterRow = false;
  for (const [li, l] of lines.entries()) {
    const found = new Set([...l.line.matchAll(ROLL_RE)].map((m) => m[1].toLowerCase()));
    if (!found.size) {
      // A short heading line such as "LA 001 - LEFT ROW" or "Sub-group 3" applies to the rows below it.
      if (l.line.length >= 3 && l.line.length <= 80 && HEADING_RE.test(l.line) && !COLUMNS_RE.test(l.line)) section = l.line;
      if (firstRow >= 0 && isBlockLine(l.line) && li > firstRow) {
        if (afterRow) block = [];
        block.push(l.line);
        afterRow = false;
      }
      continue;
    }
    afterRow = true;
    const context = [title, ...block, section].filter(Boolean).join(" · ").replace(/\s+/g, " ") || null;
    for (const roll of found) rows.push({ roll, page: l.page, line: l.line.slice(0, 500), context: context ? context.slice(0, 400) : null, columns });
  }
  return rows;
}

/** The shareable part of a class list: only what comes before the first student row (title, headers). */
export function rosterHeader(pages: Page[]): Page[] {
  const roll = new RegExp(ROLL_RE.source, "i");
  for (const p of pages) {
    const lines = p.text.split("\n");
    const first = lines.findIndex((l) => roll.test(l));
    if (first >= 0) return [{ page: p.page, text: lines.slice(0, first).join("\n").slice(0, 1500) }];
  }
  return [];
}
