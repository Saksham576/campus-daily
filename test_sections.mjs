import assert from "node:assert";
import { placeItem, buildSections } from "./src/lib/sections.ts";

console.log("Feed sections tests...");
const now = new Date("2026-10-15T06:00:00Z");
const mine = new Set(["MA 105", "CH 111", "CS 101"]);
const base = { received_at: "2026-10-14T10:00:00Z", tags: [], status: "new" };

const scholarship = { ...base, id: "a", subject: "Last day to apply: Rupa Rahul Bajaj Scholarship", summary: "Apply by 18 October 2026 at 11:59 PM." };
const quiz = { ...base, id: "b", subject: "CH 111-2026-1-D3: Quiz on Friday, October 16th: Logistics", body: "Quiz on 16 October 2026 at 8:30 AM in LA 201" };
const talk = { ...base, id: "c", subject: "[S.Events] Quantum 101 Talk | Maths and Physics Club", body: "Talk on 17 October 2026 at 6 PM in LH 101", tags: ["Talks & Seminars"] };
const oldTalk = { ...base, id: "d", subject: "[S.Events] Figma 101 workshop", body: "Workshop on 12 October 2026 at 6 PM in LC 101" };
const hostel = { ...base, id: "e", subject: "Hostel 16 mess timing change", source: "whatsapp" };
const intern = { ...base, id: "f", subject: "Internship opportunity at L&T", summary: "Great opening for freshers." };
const otherCourse = { ...base, id: "g", subject: "PH 109-2026-1-D2: Group activity" };

assert.strictEqual(placeItem(scholarship, mine, now).section, "action");
assert.strictEqual(placeItem(quiz, mine, now).section, "exams", "quizzes now have their own section");
assert.strictEqual(placeItem(quiz, mine, now).myCourse, "CH 111");
assert.strictEqual(placeItem(talk, mine, now).section, "events");
assert.strictEqual(placeItem(oldTalk, mine, now), null, "past events drop out");
assert.strictEqual(placeItem(hostel, mine, now).section, "campus");
assert.strictEqual(placeItem(intern, mine, now).section, "opportunities");
assert.notStrictEqual(placeItem(otherCourse, mine, now).section, "courses", "not my course");
assert.strictEqual(placeItem({ ...scholarship, status: "done" }, mine, now), null, "done actions leave");

// Stable order: a high-priority deadline is not pushed down by newer items
const newer = { ...base, id: "h", received_at: "2026-10-15T05:00:00Z", subject: "Register for Freshiezza", summary: "Register by 25 October 2026 at 5 PM." };
const s = buildSections([newer, scholarship, talk, quiz, { ...intern, status: "kept" }], mine, now);
assert.deepStrictEqual(s.action.map((x) => x.id), ["a", "h"], "earliest deadline first, regardless of arrival");
assert.deepStrictEqual(s.saved.map((x) => x.id), ["f"]);
assert.strictEqual(s.all.length, 5);
console.log("✓ Passed: notices land in stable sections; deadlines sorted by due date");

// Old digest items store tags as a string or object (jsonb) — must not crash the board
import { normalizeTags } from "./src/lib/sections.ts";
assert.deepStrictEqual(normalizeTags("Academics, Events"), ["academics", "events"]);
assert.deepStrictEqual(normalizeTags({ Hostel: 1 }), ["hostel"]);
assert.deepStrictEqual(normalizeTags(null), []);
const odd = [
  { ...base, id: "s1", subject: "Hostel 16 water cut", tags: "Hostel / Campus Life" },
  { ...base, id: "s2", subject: "Fest night", tags: { fest: true } },
  { ...base, id: "s3", subject: "Weird", tags: 42, body: null, summary: null },
];
const so = buildSections(odd, mine, now);
assert.strictEqual(so.all.length, 3, "all odd items still shown");
console.log("✓ Passed: odd tag shapes never break the board");

// Exams & quizzes get their own section, soonest first; solutions/results stay with the course
const q1 = { ...base, id: "q1", subject: "CH 111-2026-1-D3: Quiz on Friday, October 16th: Logistics", body: "Quiz at 8:30 AM in LA 201" };
const q2 = { ...base, id: "q2", subject: "MA 105 Quiz 3 on 23 October 2026", body: "2 PM, LT 204" };
const sol = { ...base, id: "q3", subject: "CS 105-2026-1-D3: Midsem solutions" };
assert.strictEqual(placeItem(q1, mine, now).section, "exams");
assert.strictEqual(placeItem(sol, mine, now).section !== "exams", true);
const se = buildSections([q2, q1, sol], mine, now);
assert.deepStrictEqual(se.exams.map((x) => x.id), ["q1", "q2"]);
console.log("✓ Passed: exams & quizzes section");
