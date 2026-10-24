import assert from "node:assert";
import { updateFromNotice } from "./src/lib/timetable/updates.ts";
import { DATE_RANGE_RE } from "./src/lib/events.ts";
import { relevanceOf } from "./src/lib/relevance.ts";
import { COURSE_CATALOG } from "./src/lib/timetable/catalog.ts";

const NOW = new Date("2026-10-22T13:44:59Z");
console.log("Batch A tests...");

// T1: a week-long range must not become one exam block with a made-up time.
const endsem = updateFromNotice(
  "PH 117-2026-1-ALL: About endsem exam",
  "The lab end-semester examination will be held during the week of 26–30 October .\n\n You are expected to revise all eight experiments. The examination will be 90 minutes long . One experiment will be assigned to you at random.",
  "n-ph",
  NOW
);
assert.strictEqual(endsem, null, "a date range with no time adds nothing to the timetable");

// A quiz with one day and a written time still lands on the timetable.
const quiz = updateFromNotice("MA 105 Quiz 2", "MA 105 Quiz 2 will be held on 5 November 2026 at 5:15 pm in LA 001.", "n-q", NOW);
assert.ok(quiz && quiz.kind === "added" && quiz.on_date === "2026-11-05", "a dated and timed quiz is added");
assert.ok(quiz.new_start.startsWith("2026-11-05T11:45"), "17:15 IST is 11:45 UTC");

// A quiz with a day but no time is not placed (it would otherwise get 10:00).
assert.strictEqual(updateFromNotice("CS 101 Endsem exam", "The CS 101 endsem exam is on 30 October 2026.", "n-e", NOW), null);

// Date ranges are recognised, single dates are not.
assert.ok(DATE_RANGE_RE.test("held during the week of 26–30 October"));
assert.ok(DATE_RANGE_RE.test("from Oct 26-30"));
assert.ok(DATE_RANGE_RE.test("26th to 30th October"));
assert.ok(!DATE_RANGE_RE.test("on 30 October at 10:00-13:00"));

// T2: inter-hostel championships must not reach a student only because they say "hostel".
const p = { categories: ["Academics", "Talks & Seminars"], keywords: ["Mess & hostel updates", "Robotics"], hostel: "Hostel 16", year: "1", mode: "focused" };
const gc = [
  ["[S.Events] Astronomy General Championship 2026 | Krittika - The Astronomy Club", "Participate in the Astronomy General Championship organized by Krittika. Compete for hostel points on 28 October 2026.", ["Competitions / Hackathons", "Academics"]],
  ["[S.Events] Group Dance Auditions | IICM 9.0 | Open For All", "InSync Dance Club is holding Group Dance Auditions. Represent your hostel.", ["Fests & Cultural"]],
  ["[S.Events] Come Support your Hostel at Freshiezza Solo and Group Dance Competition", "FRESHIEZZA DANCE 2026 solo and group dance competition for freshers. Students are invited to attend and support their hostels.", ["Fests & Cultural"]],
  ["[S.Events] The Weightlifting General Championship | 24th October", "Weigh-in at the Weightlifting Room. Contact hostel sports coordinators.", ["Sports"]],
];
for (const [subject, summary, tags] of gc) assert.strictEqual(relevanceOf({ subject, summary, tags }, p).relevant, false, subject);

// They still reach students who follow that activity.
const astro = relevanceOf({ subject: gc[0][0], summary: gc[0][1], tags: gc[0][2] }, { ...p, keywords: ["Astronomy"] });
assert.ok(astro.relevant, "Astronomy GC reaches an astronomy follower");
const dance = relevanceOf({ subject: gc[2][0], summary: gc[2][1], tags: gc[2][2] }, { ...p, keywords: ["Dance"] });
assert.ok(dance.relevant, "Freshiezza reaches a dance follower");

// A real mess notice still reaches someone who follows mess and hostel updates.
assert.ok(relevanceOf({ subject: "Mess menu change for this week", summary: "Hostel 16 mess closed for dinner on Friday", tags: [] }, p).relevant);
assert.ok(relevanceOf({ subject: "Water supply in Wing A will be off", summary: "Hostel 16 tank cleaning", tags: [] }, p).relevant);

// T20: official first-year lecture halls (Academic Office timetable, Autumn 2026-27).
const venue = (code, div) => COURSE_CATALOG[code].divisions.find((d) => d.d === div).v;
assert.strictEqual(venue("MA105", "D3"), "LA 202");
assert.strictEqual(venue("MA105", "D2"), "LA 201");
assert.strictEqual(venue("MA105", "D4"), "LA 201");
assert.strictEqual(venue("CH111", "D1"), "LA 201");
assert.strictEqual(venue("CH111", "D2"), "LA 202");
assert.strictEqual(venue("CH111", "D4"), "LA 202");
assert.strictEqual(venue("BB101", "D1"), "LH 302");
assert.strictEqual(venue("BB101", "D2"), "LH 302");
assert.deepStrictEqual(COURSE_CATALOG.CH111.divisions.find((d) => d.d === "D3").t, ["X2"]);

console.log("✓ Passed: date ranges, GC notices and first-year rooms");

// T3/T4: phone alerts follow the student's own filter.
const { worthAnAlert, profileFromSubscriber } = await import("./src/lib/relevance.ts");
const me = { categories: ["Academics", "Competitions / Hackathons", "Talks & Seminars"], keywords: "AI/ML, robotics, techfest", hostel: "Hostel 16", department: "Metallurgical Engineering & Materials Science (MEMS)", year: "1", feed_mode: "balanced", courses: ["CH111", "CS101", "ENT101", "MA105", "PH117"] };
assert.strictEqual(profileFromSubscriber(me).mode, "balanced");
assert.strictEqual(profileFromSubscriber(me, "focused").mode, "focused");
const film = { subject: "[S.Events] Inter-IIT Filmmaking Auditions 2026", summary: "Applications and auditions are open for the IIT Bombay Filmmaking Contingent for Inter-IIT Cultural Meet 9.0.", tags: ["Fests & Cultural", "Competitions / Hackathons"], source: "ingest-mail" };
assert.strictEqual(worthAnAlert(film, me), false, "filmmaking auditions do not buzz someone who never followed films");
assert.strictEqual(worthAnAlert(film, { ...me, keywords: "Films" }), true, "they do for a film follower");
const ent = { subject: "[WhatsApp · ENT101 AUT 2026 - Students] Final teams, startup allocations released", summary: "Final teams for ENT101 are on Google Sheets.", tags: ["Academics"], source: "whatsapp" };
assert.strictEqual(worthAnAlert(ent, me), true, "a notice naming one of your courses buzzes");
assert.strictEqual(worthAnAlert({ ...ent, subject: "[WhatsApp · x] CS105 quiz moved" }, me), false, "a course you do not take does not");
assert.strictEqual(worthAnAlert({ subject: "Moodle: new quiz", source: "moodle", tags: [] }, me), true, "your own Moodle");
assert.strictEqual(worthAnAlert({ subject: "Verified: Institute holiday tomorrow", is_verified: true, tags: [] }, me), true, "verified notices still reach everyone");
assert.strictEqual(worthAnAlert({ ...ent, deadline_at: "2026-10-01T00:00:00Z" }, me, new Date("2026-10-25T00:00:00Z")), false, "an expired deadline never buzzes");
console.log("✓ Passed: alert filter");
