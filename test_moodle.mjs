import assert from "node:assert";
import { randomBytes } from "node:crypto";
import { courseCodeFromShortname, isSeatingFile, withToken, rollFromEmail, htmlToText, moodleCall, moodleLogin } from "./src/lib/moodle.ts";

console.log("Moodle reader tests...");
assert.strictEqual(courseCodeFromShortname("CH 111-2026-1-D3"), "CH 111");
assert.strictEqual(courseCodeFromShortname("MA105-2026-1-ALL"), "MA 105");
assert.strictEqual(courseCodeFromShortname("Orientation 2026"), null);
assert.strictEqual(isSeatingFile("Quiz2_Seating_Arrangement.pdf"), true);
assert.strictEqual(isSeatingFile("CH111 room allotment.xlsx"), true);
assert.strictEqual(isSeatingFile("Lecture13_slides.pdf"), false);
assert.strictEqual(withToken("https://moodle.iitb.ac.in/webservice/pluginfile.php/1/a.pdf", "t k"), "https://moodle.iitb.ac.in/webservice/pluginfile.php/1/a.pdf?token=t%20k");
assert.strictEqual(withToken("https://x/p.php?forcedownload=1", "t"), "https://x/p.php?forcedownload=1&token=t");
assert.strictEqual(rollFromEmail("26B2477@iitb.ac.in"), "26b2477");
assert(htmlToText("<p>Quiz in <b>LA 201</b></p><p>Bring ID &amp; pen</p>").includes("Bring ID & pen"));

// Web-service calls encode arrays the way Moodle expects and surface Moodle errors
let sent = "";
const fake = async (_url, init) => {
  sent = init.body.toString();
  return { json: async () => ({ ok: 1 }) };
};
await moodleCall("tok", "mod_forum_get_forums_by_courses", { courseids: [12, 34] }, fake);
assert(sent.includes("courseids%5B0%5D=12") && sent.includes("courseids%5B1%5D=34") && sent.includes("wsfunction=mod_forum_get_forums_by_courses"));
await assert.rejects(
  moodleCall("tok", "x", {}, async () => ({ json: async () => ({ exception: "moodle_exception", errorcode: "invalidtoken" }) })),
  /invalidtoken/
);
await assert.rejects(moodleLogin("u", "p", async () => ({ json: async () => ({ errorcode: "invalidlogin", error: "Invalid login" }) })), /Wrong Moodle/);
assert.strictEqual(await moodleLogin("u", "p", async () => ({ json: async () => ({ token: "abc" }) })), "abc");

// Tokens are stored encrypted and round-trip
process.env.MOODLE_TOKEN_KEY = randomBytes(32).toString("base64");
const { encryptSecret, decryptSecret } = await import("./src/lib/server/crypto.ts");
const enc = encryptSecret("secret-token-123");
assert(!enc.includes("secret-token"));
assert.strictEqual(decryptSecret(enc), "secret-token-123");
assert.notStrictEqual(encryptSecret("x"), encryptSecret("x"), "random IV");
console.log("✓ Passed: Moodle helpers, web-service encoding and token encryption");
