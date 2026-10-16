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
assert.notStrictEqual(placeItem(otherCourse, mine, now)?.section, "courses", "not my course");
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
assert.strictEqual(placeItem(sol, mine, now)?.section !== "exams", true);
const se = buildSections([q2, q1, sol], mine, now);
assert.deepStrictEqual(se.exams.map((x) => x.id), ["q1", "q2"]);
console.log("✓ Passed: exams & quizzes section");

// Real notices that wrongly showed under Exams: follow-ups, celebrations, undated, past
const wrong = [
  "CS 105-2026-1-D3: Midsem answersheets and crib session TONIGHT",
  "[Bodhitree] Theory Quiz 2 Paper and Solutions Uploaded",
  "MA 105- midsem exam answer script released",
  "[S.Events] Mid-Sems Are Over, Now Come Celebrate! PG Night",
  "[Bodhitree] Syllabus for theory quiz 2",
  "MA 105 Quiz 4 announced", // no date yet
];
for (const s of wrong) {
  const p = placeItem({ ...base, id: s, subject: s, body: "by Prof X - Thursday, 15 October 2026, 2:34 PM\nSee attached." }, mine, now);
  assert.strictEqual(p?.section === "exams", false, s);
}
const past = { ...base, id: "p", subject: "MA 105 Quiz 1 on 1 October 2026", body: "2 PM" };
assert.strictEqual(placeItem(past, mine, now).section, "courses", "a past quiz stays with the course");
console.log("✓ Passed: only upcoming, dated assessments appear under Exams");

// Real ones that SHOULD be there, and club quizzes that shouldn't
const syl = { ...base, id: "syl", subject: "MA 105-2026-1-ALL: Quiz 2 syllabus", body: "Dear Students, The syllabus for the second quiz for MA 105, to be held on Friday, 23rd October , is as follows: Double and triple integration" };
assert.strictEqual(placeItem(syl, mine, now).section, "exams", "syllabus for an upcoming quiz");
const club = { ...base, id: "club", subject: "[S.Events] Heisenberg - Fresher's Orientation | Chemistry Club and ChemETL |17th - LH 101 - 5 pm", body: "an exciting chemistry quiz packed with mind-bending questions" };
assert.notStrictEqual(placeItem(club, mine, now).section, "exams", "club quiz is an event");
const bt = { ...base, id: "bt", subject: "[Bodhitree] [Forum - CS101A26] Theory Quiz 3 on 28th October", body: "Course: CS101A26 - Computer Programming" };
assert.strictEqual(placeItem(bt, new Set(["CS 101"]), now).section, "exams", "Bodhitree course code CS101A26");
const other = { ...base, id: "o", subject: "PH 107 Quiz 2 on 23 October 2026", body: "2 PM" };
assert.notStrictEqual(placeItem(other, mine, now)?.section, "exams", "not my course");
console.log("✓ Passed: exams only for your courses; club quizzes stay events");

// Course mail for courses you don't take, and doubt-forum chatter, stay off your board
assert.strictEqual(placeItem({ ...base, id: "c1", subject: "CS 105-2026-1-D3: Midsem answersheets and crib session TONIGHT", from_address: "Bharat Adsul (via IITB Moodle) <noreply@moodle.iitb.ac.in>" }, mine, now), null);
assert.strictEqual(placeItem({ ...base, id: "c2", subject: "BB101(D2): Lecture today (Friday, 16.10.2026) at 2.0PM in LH302", from_address: "pbhaumik@iitb.ac.in" }, mine, now), null);
assert.strictEqual(placeItem({ ...base, id: "c3", subject: "MA 105-2026-1-ALL: MA105 Quizz", body: "MA 105-2026-1-ALL -> Forums -> Doubt Forum -> MA105 Quizz" }, mine, now), null);
assert.notStrictEqual(placeItem({ ...base, id: "c4", subject: "[S.Events] Reminder: CP 101 Tonight at 8:30 PM | Venue Changed to LH101", from_address: "gsectech@iitb.ac.in" }, mine, now), null, "club event named like a course stays");
assert.strictEqual(placeItem({ ...base, id: "c5", subject: "CH 111-2026-1-D3: New file — CH111 Physical Slides", source: "moodle" }, mine, now).section, "courses");
console.log("✓ Passed: other courses' mail and doubt-forum chatter stay off your board");
