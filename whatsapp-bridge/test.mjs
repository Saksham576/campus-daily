import assert from "node:assert";
import { isRelevant, toIngestPayload } from "./lib.mjs";

assert.strictEqual(isRelevant("ok"), false);
assert.strictEqual(isRelevant("Thanks everyone for coming to the meeting today!!"), false);
assert.strictEqual(isRelevant("MA 105 tutorial tomorrow is cancelled, next one on Friday at 8:30 AM in LT 101."), true);
assert.strictEqual(isRelevant(undefined), false);

const p = toIngestPayload({
  id: "true_123@g.us_ABC",
  group: "H16 Freshers",
  author: "GSec",
  body: "*CS 101 lab shifted* to Mindsparks Lab\nTomorrow 2 PM",
  timestamp: 1792000000,
});
assert.strictEqual(p.messageId, "wa:true_123@g.us_ABC");
assert.strictEqual(p.subject, "[WhatsApp · H16 Freshers] CS 101 lab shifted to Mindsparks Lab");
assert.strictEqual(p.from, "WhatsApp: H16 Freshers (GSec)");
assert.strictEqual(p.date, new Date(1792000000 * 1000).toISOString());
console.log("✓ WhatsApp bridge tests passed");
