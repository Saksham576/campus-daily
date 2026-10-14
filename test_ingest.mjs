import assert from "node:assert";
import {
  isAuthorizedIngest,
  parseInboundEmail,
  parseScoredNotice,
  buildItemRow,
  itemIdFor,
  stripHtml,
  buildScoringPrompt,
  scoreWithGemini,
} from "./src/lib/ingest.ts";

console.log("Ingest tests: auth, parsing, scoring validation, row building...");

assert.strictEqual(isAuthorizedIngest("s3cret", "s3cret"), true);
assert.strictEqual(isAuthorizedIngest("wrong", "s3cret"), false);
assert.strictEqual(isAuthorizedIngest(null, "s3cret"), false);
assert.strictEqual(isAuthorizedIngest("anything", undefined), false);
assert.strictEqual(isAuthorizedIngest("", ""), false);

assert.strictEqual(parseInboundEmail(null), null);
assert.strictEqual(parseInboundEmail({ subject: "", text: "" }), null);
const em = parseInboundEmail({
  messageId: "<abc@iitb.ac.in>",
  subject: "MA 105 Quiz moved",
  from: "ugacademic@iitb.ac.in",
  date: "2026-10-14T03:00:00Z",
  html: "<p>Quiz now in <b>LA 201</b> &amp; at 2 PM. See https://moodle.iitb.ac.in/x</p><script>evil()</script>",
});
assert(em.body.includes("LA 201") && em.body.includes("& at 2 PM") && !em.body.includes("evil"));
assert.strictEqual(stripHtml("<style>a{}</style>x<br>y"), "x\ny");
assert.strictEqual(parseInboundEmail({ subject: "s", text: "t", date: "garbage" }).subject, "s");
const a = parseInboundEmail({ subject: "s", from: "f", text: "t", date: "2026-01-01T00:00:00Z" });
const b = parseInboundEmail({ subject: "s", from: "f", text: "t", date: "2026-01-01T00:00:00Z" });
assert.strictEqual(a.messageId, b.messageId);
assert.strictEqual(itemIdFor("<X@a>"), itemIdFor("<x@a>"));

assert(buildScoringPrompt(em).includes("untrusted data"));

const good = parseScoredNotice('```json\n{"score": 14, "summary": "Quiz moved", "tags": ["Academics","Bogus"], "is_personal": false, "target_years": ["1"]}\n```');
assert.strictEqual(good.score, 10);
assert.deepStrictEqual(good.tags, ["Academics"]);
assert.deepStrictEqual(good.target_years, ["1"]);
assert.strictEqual(parseScoredNotice("not json"), null);
assert.strictEqual(parseScoredNotice('{"score":"abc"}'), null);
assert.strictEqual(parseScoredNotice('{"score":0}').score, 1);

const row = buildItemRow(em, good);
assert.strictEqual(row.id, itemIdFor("<abc@iitb.ac.in>"));
assert.deepStrictEqual(row.links, ["https://moodle.iitb.ac.in/x"]);
assert.strictEqual(row.received_at, "2026-10-14T03:00:00.000Z");

const fakeFetch = async (url, init) => {
  assert(String(url).includes("gemini-2.5-flash-lite"));
  assert.strictEqual(init.headers["x-goog-api-key"], "k");
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"score":8,"summary":"s"}' }] } }] }) };
};
assert.strictEqual((await scoreWithGemini(em, "k", fakeFetch)).score, 8);
await assert.rejects(scoreWithGemini(em, "k", async () => ({ ok: false, status: 429 })));

console.log("✓ Passed: ingest auth, parsing, score validation, row mapping and Gemini call verified");
