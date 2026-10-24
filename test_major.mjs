import assert from "node:assert";
import { majorKey, isMajorEvent, bigEventsSoon, whenLabel } from "./src/lib/majorEvents.ts";
import { majorAlert } from "./src/lib/majorAlert.ts";
import { relevanceOf } from "./src/lib/relevance.ts";

console.log("Big institute events tests...");

// The real subjects that were announced and then missed (24 Oct 2026, OAT).
const mail = "[S.Events] Mood Indigo 2026 Insti Nite | Karan Kanchan & Friends Live at OAT!";
const insta = "InstiNite is here, and Mood Indigo is ready to kick things up a notch! 🔥✨";
assert.strictEqual(majorKey(mail), "instinite", "'Nite' is read, and the Insti Nite key wins over Mood Indigo");
assert.strictEqual(majorKey(insta), "instinite", "the Instagram post names the same event");
assert.strictEqual(majorKey("Insti Night 2026 tonight at OAT"), "instinite");
assert.strictEqual(majorKey("[Student-notices] Invitation | Prof. N. R. Kamath Distinguished Institute Lecture by Prof. Herbert Huppert"), "institutelecture");
assert.strictEqual(majorKey("Mood Indigo auditions for the choir"), null, "an audition for it is not the event");
assert.strictEqual(majorKey("[S.Events] Inter-IIT Filmmaking Auditions 2026"), null);
assert.strictEqual(majorKey("Quant Club Merch Drop is LIVE"), null);
assert.strictEqual(majorKey("[S.Events] Astronomy General Championship 2026"), null, "a championship is not an institute event");
assert.strictEqual(majorKey("Get Ready for all the fun at Avenues 2026"), null, "a department fest is not institute-wide");
assert.ok(isMajorEvent("Convocation 2026: schedule"));

// A focused first-year who follows only robotics now sees it.
const p = { categories: ["Academics"], keywords: ["Robotics"], hostel: "Hostel 16", year: "1", mode: "focused" };
assert.ok(relevanceOf({ subject: mail, summary: "Insti Nite concert at the OAT on 24th October at 5:00 PM", tags: ["Fests & Cultural"] }, p).relevant);
assert.ok(relevanceOf({ subject: insta, summary: "InstiNite, first concert of Mood Indigo 2026", tags: ["Fests & Cultural"], source: "instagram" }, p).relevant);

// Phone alert: once, in the three days before, with one tag shared by mail and Instagram.
const body = "The 56th edition of Mood Indigo is officially here.\n24th October 2026 at 5:00 PM at the OAT. Entry requires a valid physical IITB ID card.";
const sent = new Date("2026-10-23T07:27:00Z"); // 12:57 IST on 23 Oct, when the mail arrived
const a1 = majorAlert(mail, body, sent);
assert.ok(a1, "the Insti Nite mail would have buzzed");
assert.strictEqual(a1.key, "major:instinite:2026-10-24");
assert.strictEqual(majorAlert(insta, "📅 24th October\n⏰ 5 PM onwards\n📍 OAT, IIT Bombay", new Date("2026-10-20T13:41:00Z")), null, "four days ahead is too early");
assert.strictEqual(majorAlert(insta, "📅 24th October\n⏰ 5 PM onwards\n📍 OAT", new Date("2026-10-22T13:41:00Z"))?.key, a1.key, "mail and Instagram share a tag");
assert.strictEqual(majorAlert(mail, body, new Date("2026-10-25T12:00:00Z")), null, "after the event nothing buzzes");
assert.strictEqual(majorAlert(mail, "No date is written here.", sent), null, "no written date, no buzz");
assert.strictEqual(majorAlert("Mood Indigo registrations open", body, sent), null, "registrations do not buzz everyone");

// Home card: one entry per event, only when it is on or close.
const items = [
  { id: "1", subject: mail, when: "2026-10-24T11:30:00Z" },
  { id: "2", subject: insta, when: "2026-10-24T11:30:00Z" },
  { id: "3", subject: "Get Ready for Avenues 2026", when: "2026-10-24T12:00:00Z" },
  { id: "4", subject: "Convocation 2026", when: "2026-11-30T05:00:00Z" },
];
const evening = new Date("2026-10-24T09:00:00Z"); // 14:30 IST
const soon = bigEventsSoon(items, evening);
assert.deepStrictEqual(soon.map((i) => i.id), ["1"], "one card for Insti Nite, none for Avenues or a far-off convocation");
assert.strictEqual(bigEventsSoon(items, new Date("2026-10-25T09:00:00Z")).length, 0, "gone a day later");
assert.strictEqual(bigEventsSoon(items, new Date("2026-10-24T12:30:00Z")).length, 1, "still shown while it is on");

assert.strictEqual(whenLabel("2026-10-24T11:30:00Z", evening), "Tonight 5:00 pm");
assert.strictEqual(whenLabel("2026-10-25T11:30:00Z", evening), "Tomorrow 5:00 pm");
assert.strictEqual(whenLabel("2026-10-24T11:30:00Z", new Date("2026-10-24T12:00:00Z")), "On now");
assert.strictEqual(whenLabel("2026-10-24T05:30:00Z", new Date("2026-10-24T01:00:00Z")), "Today 11:00 am");

console.log("✓ Passed: Insti Nite is a big event, buzzes once and appears on Home");
