import assert from "node:assert";
import { parseBusinessDiscovery, isUsefulCaption, postToEmail, normaliseHandle } from "./src/lib/instagram.ts";
import { privateMailReason } from "./src/lib/ingest.ts";
import { senderName } from "./src/lib/display.ts";

console.log("Instagram reader tests...");
const reply = { business_discovery: { username: "e_cell_iitb", name: "E-Cell IIT Bombay", media: { data: [
  { id: "1", caption: "Orientation night is on 24 Oct at 7 PM in SAC. Register: bit.ly/x #ecell", timestamp: "2026-10-21T10:00:00+0000", permalink: "https://www.instagram.com/p/a/" },
  { id: "2", caption: "🔥🔥", timestamp: "2026-10-22T10:00:00+0000", permalink: "https://www.instagram.com/p/b/" },
] } } };
const parsed = parseBusinessDiscovery(reply);
assert.strictEqual(parsed.name, "E-Cell IIT Bombay");
assert.strictEqual(parsed.posts[0].id, "2", "newest first");
assert.strictEqual(parseBusinessDiscovery({ error: { message: "x" } }), null);
assert.ok(isUsefulCaption(reply.business_discovery.media.data[0].caption));
assert.ok(!isUsefulCaption("🔥🔥 #ecell @iitbombay"), "emoji and tags alone say nothing");
const mail = postToEmail("e_cell_iitb", parsed.name, reply.business_discovery.media.data[0]);
assert.strictEqual(mail.from, "Instagram: @e_cell_iitb");
assert.ok(mail.subject.startsWith("Orientation night is on 24 Oct"), "first line is the headline");
assert.ok(mail.body.includes("https://www.instagram.com/p/a/"), "link kept");
assert.strictEqual(privateMailReason(mail), null);
assert.strictEqual(senderName(mail.from), "@e_cell_iitb · Instagram");
assert.strictEqual(normaliseHandle("https://www.instagram.com/E_Cell_IITB/?hl=en"), "e_cell_iitb");
assert.strictEqual(normaliseHandle("@Techfest_IITB"), "techfest_iitb");
console.log("✓ Passed: Instagram posts become notices; empty captions are skipped");
