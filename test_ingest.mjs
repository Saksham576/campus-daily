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
  personalizeScore,
  fromForwardEmailPayload,
  isValidForwardEmailSignature,
  isGoogleIngestIdentity,
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

const row = buildItemRow(em, good, { source: "whatsapp", venue: "LA 201" });
assert.strictEqual(row.id, itemIdFor("<abc@iitb.ac.in>"));
assert.deepStrictEqual(row.links, ["https://moodle.iitb.ac.in/x"]);
assert.strictEqual(row.received_at, "2026-10-14T03:00:00.000Z");
assert.strictEqual(row.sender, "ugacademic@iitb.ac.in");
assert.strictEqual(row.source, "whatsapp");
assert.strictEqual(row.venue, "LA 201");
assert.strictEqual("score" in row || "from_address" in row, false, "only live items columns");

// Personalised scores
const targeted = { ...good, score: 8, target_departments: ["Computer Science"], target_years: [], target_hostels: [] };
assert.strictEqual(personalizeScore(targeted, { email: "a", department: "Computer Science & Engineering" }), 8);
assert.strictEqual(personalizeScore(targeted, { email: "b", department: "Mechanical Engineering" }), 5);
assert.strictEqual(personalizeScore({ ...targeted, score: 2 }, { email: "c", department: null }), 1);
assert.strictEqual(personalizeScore({ ...good, target_departments: [], target_years: [], target_hostels: [] }, { email: "d" }), 10);

const fakeFetch = async (url, init) => {
  assert(String(url).includes("gemini-3.5-flash-lite"));
  assert.strictEqual(init.headers["x-goog-api-key"], "k");
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"score":8,"summary":"s"}' }] } }] }) };
};
assert.strictEqual((await scoreWithGemini(em, "k", fakeFetch)).score, 8);
await assert.rejects(scoreWithGemini(em, "k", async () => ({ ok: false, status: 429 })));

// Forward Email webhook
import { createHmac } from "node:crypto";
const fe = {
  messageId: "<fe1@iitb.ac.in>",
  from: { text: "UG Office <ugoffice@iitb.ac.in>" },
  date: "2026-10-15T05:00:00.000Z",
  text: "CS 101 lab on 16 October 2026 is cancelled.",
  headerLines: [{ key: "subject", line: "Subject: CS 101 lab cancelled" }],
};
const feMapped = parseInboundEmail(fromForwardEmailPayload(fe));
assert.strictEqual(feMapped.subject, "CS 101 lab cancelled");
assert.strictEqual(feMapped.from, "UG Office <ugoffice@iitb.ac.in>");
assert.strictEqual(feMapped.messageId, "<fe1@iitb.ac.in>");
const rawBody = JSON.stringify(fe);
const sig = createHmac("sha256", "k3y").update(rawBody).digest("hex");
assert.strictEqual(isValidForwardEmailSignature(rawBody, sig, "k3y"), true);
assert.strictEqual(isValidForwardEmailSignature(rawBody + " ", sig, "k3y"), false);
assert.strictEqual(isValidForwardEmailSignature(rawBody, sig, undefined), false);
assert.strictEqual(isValidForwardEmailSignature(rawBody, "short", "k3y"), false);

// Google identity (Apps Script) auth
const future = Math.floor(Date.now() / 1000) + 600;
const tokeninfo = (info) => async () => ({ ok: true, json: async () => info });
const goodInfo = { iss: "https://accounts.google.com", exp: String(future), email: "CampusDaily.Ingest@gmail.com", email_verified: "true" };
assert.strictEqual(await isGoogleIngestIdentity("Bearer abc.def.ghi", "campusdaily.ingest@gmail.com", tokeninfo(goodInfo)), true);
assert.strictEqual(await isGoogleIngestIdentity("Bearer abc.def.ghi", "campusdaily.ingest@gmail.com", tokeninfo({ ...goodInfo, email: "someone@gmail.com" })), false);
assert.strictEqual(await isGoogleIngestIdentity("Bearer abc.def.ghi", "campusdaily.ingest@gmail.com", tokeninfo({ ...goodInfo, email_verified: "false" })), false);
assert.strictEqual(await isGoogleIngestIdentity("Bearer abc.def.ghi", "campusdaily.ingest@gmail.com", tokeninfo({ ...goodInfo, exp: "1" })), false);
assert.strictEqual(await isGoogleIngestIdentity("Bearer abc.def.ghi", "campusdaily.ingest@gmail.com", tokeninfo({ ...goodInfo, iss: "evil.com" })), false);
assert.strictEqual(await isGoogleIngestIdentity("Basic xyz", "campusdaily.ingest@gmail.com", tokeninfo(goodInfo)), false);
assert.strictEqual(await isGoogleIngestIdentity(null, "campusdaily.ingest@gmail.com", tokeninfo(goodInfo)), false);
assert.strictEqual(await isGoogleIngestIdentity("Bearer x", "campusdaily.ingest@gmail.com", async () => ({ ok: false })), false);

console.log("✓ Passed: ingest auth, parsing, score validation, row mapping and Gemini call verified");
