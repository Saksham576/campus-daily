import assert from "node:assert";
import { zipSync, strToU8 } from "fflate";
import { extractText, chunkPages, rosterRows, rosterHeader, looksScanned, docKind } from "./src/lib/docs/extract.ts";

console.log("Document reading tests...");

// Word
const docx = zipSync({ "word/document.xml": strToU8('<w:document><w:body><w:p><w:r><w:t>MA 105 grading</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Midsem 30% &amp; Endsem 50%</w:t></w:r></w:p></w:body></w:document>') });
const d = await extractText(docx, "Course policy.docx");
assert.match(d.pages[0].text, /MA 105 grading\nMidsem 30% & Endsem 50%/);

// PowerPoint: slides in order
const pptx = zipSync({
  "ppt/slides/slide2.xml": strToU8("<p:sld><a:p><a:r><a:t>Slide two</a:t></a:r></a:p></p:sld>"),
  "ppt/slides/slide1.xml": strToU8("<p:sld><a:p><a:r><a:t>Hydrogen atom</a:t></a:r></a:p></p:sld>"),
});
const p = await extractText(pptx, "Lecture 8.pptx");
assert.deepStrictEqual(p.pages.map((x) => [x.page, x.text]), [[1, "Hydrogen atom"], [2, "Slide two"]]);

// Excel: shared strings + numbers
const xlsx = zipSync({
  "xl/sharedStrings.xml": strToU8("<sst><si><t>Roll</t></si><si><t>Dues</t></si><si><t>26b2477</t></si></sst>"),
  "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row><row><c t="s"><v>2</v></c><c><v>4200</v></c></row></sheetData></worksheet>'),
});
const x = await extractText(xlsx, "Mess dues.xlsx");
assert.strictEqual(x.pages[0].text, "Roll\tDues\n26b2477\t4200");

// PDF (tiny hand-written file)
const pdfSrc = (() => {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = "BT /F1 18 Tf 20 80 Td (Quiz 2 syllabus: Jacobians) Tj ET";
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return out;
})();
const pdf = await extractText(new TextEncoder().encode(pdfSrc), "syllabus.pdf");
assert.match(pdf.pages[0].text, /Quiz 2 syllabus: Jacobians/);
assert.strictEqual(looksScanned(pdf), true, "very little text per page counts as a possible scan");
assert.strictEqual(docKind("photo.jpg"), null);

// Chunks stay within pages
const ch = chunkPages([{ page: 1, text: "a".repeat(900) + "\n" + "b".repeat(900) }, { page: 2, text: "c" }]);
assert.deepStrictEqual(ch.map((c) => c.page), [1, 1, 2]);

// Class lists: only own rows, header kept, nothing between rows
const rows = Array.from({ length: 12 }, (_, i) => `26b24${String(70 + i).padStart(2, "0")}  Student ${i}  Rs ${1000 + i}`);
const roster = [{ page: 1, text: ["Hostel 16 mess dues — October", "Roll  Name  Amount", ...rows].join("\n") }];
const rr = rosterRows(roster);
assert.ok(rr && rr.length === 12);
assert.strictEqual(rr.find((r) => r.roll === "26b2477").line, "26b2477  Student 7  Rs 1007");
assert.deepStrictEqual(rosterHeader(roster), [{ page: 1, text: "Hostel 16 mess dues — October\nRoll  Name  Amount" }]);
assert.strictEqual(rosterRows([{ page: 1, text: "Contact 26b2477 for details" }]), null, "a few roll numbers is not a class list");
console.log("✓ Passed: PDF / Word / PowerPoint / Excel text, chunks, and class-list privacy");

// A seating plan keeps the room, date and column names with each student's own row
{
  const seat = [
    {
      page: 1,
      text: [
        "INDIAN INSTITUTE OF TECHNOLOGY BOMBAY", "Quiz 2", "Course – MA 105", "Date – 23-10-2026, Time : 05.15 pm to 6.45 pm",
        "LA 001 - LEFT ROW", "Sr. No. Seat No. Roll No Name Of The Student Division/ Tutorial",
        "1 A11 26b2401 Rohan Meena D1 T6", "2 B11 26b2402 Pritam Halder D1 T6", "3 C11 26b2403 Aditya Singh D1 T3", "4 D11 26b2404 A B D1 T4",
        "LA 001 - RIGHT ROW", "1 A12 26b2405 C D D2 T1", "2 B12 26b2406 E F D2 T2", "3 C12 26b2407 G H D2 T3", "4 D12 26b2408 I J D2 T4",
      ].join("\n"),
    },
  ];
  const sr = rosterRows(seat);
  const mine = sr.find((r) => r.roll === "26b2405");
  assert.strictEqual(mine.line, "1 A12 26b2405 C D D2 T1");
  assert.ok(/LA 001 - RIGHT ROW/.test(mine.context) && /Quiz 2/.test(mine.context) && /23-10-2026/.test(mine.context), "row keeps its room, title and date");
  assert.ok(/LEFT ROW/.test(sr.find((r) => r.roll === "26b2402").context), "rows before a new heading keep the earlier one");
  assert.ok(/Seat No/.test(mine.columns), "column names kept");
  assert.ok(!/26b24/.test(rosterHeader(seat)[0].text), "the shared header carries no roll numbers");
}
console.log("✓ Passed: seating rows keep room, date and columns");
