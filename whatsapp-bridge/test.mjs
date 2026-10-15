import assert from "node:assert";
import { isRelevant, toIngestPayload, parseGroups, isAllowedGroup, normalizeName } from "./lib.mjs";

assert.strictEqual(isRelevant("ok"), false);
assert.strictEqual(isRelevant("Thanks everyone for coming to the meeting today!!"), false);
assert.strictEqual(isRelevant("MA 105 tutorial tomorrow is cancelled, next one on Friday at 8:30 AM in LT 101."), true);
assert.strictEqual(isRelevant(undefined), false);

const groups = parseGroups("IIT Bombay Freshers' 2026 (UG)|Hostel 16|Career Cell x Freshies 2026-27");
assert.strictEqual(isAllowedGroup("IIT Bombay Freshers’ 2026 (UG)", groups), true, "curly apostrophe");
assert.strictEqual(isAllowedGroup("Career Cell × Freshies 2026-27", groups), true, "× sign");
assert.strictEqual(isAllowedGroup("hostel  16 ", groups), true);
assert.strictEqual(isAllowedGroup("Family group", groups), false);
assert.strictEqual(normalizeName("  A  B "), "a b");

const p = toIngestPayload({
  id: "true_123@g.us_ABC",
  group: "Hostel 16",
  body: "*CS 101 lab shifted* to Mindsparks Lab\nTomorrow 2 PM",
  timestamp: 1792000000,
});
assert.strictEqual(p.messageId, "wa:true_123@g.us_ABC");
assert.strictEqual(p.subject, "[WhatsApp · Hostel 16] CS 101 lab shifted to Mindsparks Lab");
assert.strictEqual(p.from, "WhatsApp: Hostel 16", "no author name or number");
assert.strictEqual(p.date, new Date(1792000000 * 1000).toISOString());
console.log("✓ WhatsApp bridge tests passed");
