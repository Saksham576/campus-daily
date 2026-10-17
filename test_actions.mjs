import assert from "node:assert";
import { validateAction, describeAction } from "./src/lib/actions.ts";
import { parseAskReply } from "./src/lib/ask.ts";

console.log("Assistant actions tests...");
const ctx = { noticeIds: ["n1", "n2"], senders: ["Office Dean SA <dean.sa.office@iitb.ac.in>"], muted: ["Spam <x@iitb.ac.in>"] };
assert.deepStrictEqual(validateAction({ type: "set_digest", mode: "email" }, ctx), { type: "set_digest", mode: "email" });
assert.strictEqual(validateAction({ type: "set_digest", mode: "sms" }, ctx), null);
assert.strictEqual(validateAction({ type: "delete_account" }, ctx), null, "unknown actions refused");
assert.strictEqual(validateAction({ type: "mute_sender", sender: "Someone else <a@b>" }, ctx), null, "only senders from the answer");
assert.ok(validateAction({ type: "mute_sender", sender: "Office Dean SA <dean.sa.office@iitb.ac.in>" }, ctx));
assert.strictEqual(validateAction({ type: "unmute_sender", sender: "Office Dean SA <dean.sa.office@iitb.ac.in>" }, ctx), null, "can only unmute muted");
assert.strictEqual(validateAction({ type: "hide_notice", notice: "n9" }, ctx), null, "only visible notices");
assert.deepStrictEqual(validateAction({ type: "save_notice", notice: "n2" }, ctx), { type: "save_notice", notice: "n2" });
assert.deepStrictEqual(validateAction({ type: "add_category", category: "sports" }, ctx), { type: "add_category", category: "Sports" });
assert.strictEqual(validateAction({ type: "add_category", category: "Admin powers" }, ctx), null);
assert.deepStrictEqual(validateAction({ type: "add_keywords", keywords: ["robotics", "x", "AI, ML"] }, ctx), { type: "add_keywords", keywords: ["robotics", "AI  ML"] });
const tt = validateAction({ type: "add_to_timetable", title: "CH 111 Quiz", start: "2026-10-23T17:15:00+05:30", end: "2026-10-23T18:15:00+05:30", location: "LA 201" }, ctx);
assert.strictEqual(tt.start, "2026-10-23T11:45:00.000Z");
assert.strictEqual(validateAction({ type: "add_to_timetable", title: "x", start: "2026-10-23T17:15:00+05:30", end: "2026-10-25T18:15:00+05:30" }, ctx), null, "max 12 h");
assert.match(describeAction(tt), /Add “CH 111 Quiz” to your timetable — Fri, 23 Oct/);
assert.strictEqual(describeAction({ type: "set_digest", mode: "off" }), "Turn off the 7:30 morning digest");

const r = parseAskReply('{"answer":"Done","sources":[],"actions":[{"type":"hide_notice","notice":2},{"type":"save_notice","notice":7}]}', [{ id: "a", subject: "A" }, { id: "b", subject: "B" }]);
assert.deepStrictEqual(r.actions.map((a) => a.notice), ["b", ""], "notice numbers → ids; out of range → empty");
console.log("✓ Passed: assistant actions are allow-listed and re-validated");
