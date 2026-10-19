import assert from "node:assert";
import { updateFromNotice, applyCourseUpdates, istDate, courseCodeOf } from "./src/lib/timetable/updates.ts";

console.log("Timetable auto-update tests...");

assert.strictEqual(courseCodeOf("MA 105: Calculus"), "MA 105");
assert.strictEqual(courseCodeOf("cs101 lab"), "CS 101");
assert.strictEqual(courseCodeOf("Hostel meeting"), null);
assert.strictEqual(istDate("2026-10-22T20:00:00Z"), "2026-10-23"); // 01:30 IST next day

// Slots: Friday 23 Oct 2026, D1-style
const slots = [
  { id: "a", title: "MA 105: Calculus", location: "LA 201", start_time: "2026-10-23T03:00:00.000Z", end_time: "2026-10-23T03:55:00.000Z", slot_type: "lecture" }, // 08:30 IST
  { id: "b", title: "MA 105: Calculus Tutorial", location: "LT 101", start_time: "2026-10-23T08:30:00.000Z", end_time: "2026-10-23T09:25:00.000Z", slot_type: "lecture" }, // 14:00 IST
  { id: "c", title: "CS 101: Programming", location: "LA 201", start_time: "2026-10-23T04:00:00.000Z", end_time: "2026-10-23T05:25:00.000Z", slot_type: "lecture" },
];

// 1. Cancellation with a time cancels only that slot
const cancel = updateFromNotice("MA 105 lecture cancelled", "The MA 105 lecture on 23 October 2026 at 8:30 AM is cancelled.", "n1");
assert.strictEqual(cancel.kind, "cancelled");
assert.strictEqual(cancel.course_code, "MA 105");
assert.strictEqual(cancel.on_date, "2026-10-23");
let r = applyCourseUpdates(slots, [cancel]);
assert.strictEqual(r.find((s) => s.id === "a").is_cancelled, true);
assert.notStrictEqual(r.find((s) => s.id === "b").is_cancelled, true);
assert.notStrictEqual(r.find((s) => s.id === "c").is_cancelled, true);
assert.strictEqual(r.find((s) => s.id === "a").notice_id, "n1");
assert.strictEqual(slots[0].is_cancelled, undefined, "input not mutated");

// 2. Cancellation without a time cancels all that course's slots that day
const cancelDay = updateFromNotice("No MA 105 class on 23 October 2026", "Classes cancelled.", "n2");
r = applyCourseUpdates(slots, [cancelDay]);
assert.strictEqual(r.filter((s) => s.is_cancelled).length, 2);

// 3. Venue change
const moved = updateFromNotice("CS 101 venue changed", "CS 101 lecture on 23 October 2026 shifted to LH 102.", "n3");
assert.strictEqual(moved.kind, "moved");
r = applyCourseUpdates(slots, [moved]);
assert.strictEqual(r.find((s) => s.id === "c").location, "LH 102");
assert.strictEqual(r.find((s) => s.id === "c").start_time, slots[2].start_time);

// 4. Quiz is added only for students taking the course
const quiz = updateFromNotice("MA 105 Quiz 2", "Quiz 2 will be held on 23rd October 2026 at 2:00 PM in LA 201.", "n4");
assert.strictEqual(quiz.kind, "added");
r = applyCourseUpdates(slots, [quiz]);
assert.strictEqual(r.length, 4);
assert.strictEqual(r[3].slot_type, "quiz");
assert.strictEqual(applyCourseUpdates([slots[2]], [quiz]).length, 1, "CS-only student does not get MA quiz");
assert.strictEqual(applyCourseUpdates(r, [quiz]).length, 4, "no duplicate on re-apply");

// 5. Follow-ups and past events never create timetable entries
const received = new Date("2026-10-15T09:10:00Z");
assert.strictEqual(
  updateFromNotice(
    "CS 105-2026-1-D3: Midsem solutions",
    "Midsem solutions by Bharat Adsul - Thursday, 15 October 2026, 2:34 PM There is no claim these are the only solutions.",
    "n5",
    received
  ),
  null,
  "Moodle posting timestamp is not an exam"
);
assert.strictEqual(updateFromNotice("MA 105 Quiz 2 results", "Quiz on 23 October 2026 at 2 PM — marks out.", "n6", received), null);
assert.strictEqual(updateFromNotice("MA 105 Quiz 3", "Quiz 3 on 10 October 2026 at 2 PM in LA 201.", "n7", received), null, "past date");
assert.strictEqual(updateFromNotice("MA 105 Quiz 3", "Quiz 3 on 23 October 2026 at 2 PM in LA 201.", "n8", received).kind, "added");
assert.strictEqual(updateFromNotice("MA 105 lecture cancelled", "Today's MA 105 lecture on 15 October 2026 at 5 PM is cancelled.", "n9", received).kind, "cancelled");

// 6. Non-course notices produce nothing
assert.strictEqual(updateFromNotice("Lost umbrella near H16", "Please contact me."), null);
assert.strictEqual(updateFromNotice("Cultural fest tonight", "Join us at SAC at 7 PM."), null);

console.log("✓ Passed: notice → course update detection and timetable application verified");

// Impossible dates never throw (they crashed the live feed)
import { extractEventDetails } from "./src/lib/events.ts";
for (const t of ["MA 105 quiz on 31/02/2026 at 2 PM", "CS 101 lab on 45th October", "PH 107 exam at 25:00 on 23 October", "CH 107 quiz 2026-13-40 10 AM", "MA 105 tut 99/99 at 9 AM"]) {
  const r = extractEventDetails("Notice", t);
  if (r) assert(!isNaN(new Date(r.start_time).getTime()) && !isNaN(new Date(r.end_time).getTime()), t);
}
console.log("✓ Passed: impossible dates are skipped safely");
// Academic years / ranges aren't dates; real DD/MM/YYYY still is
assert.strictEqual(extractEventDetails("Registrations 2026-27 open", "Apply for the 2026-27 session at 5 PM in LH 101.")?.start_time?.slice(5, 10) !== "27-26", true);
const real = extractEventDetails("MA 105 quiz", "MA 105 quiz on 23/10/2026 at 2 PM in LA 201.");
assert.strictEqual(real.start_time, "2026-10-23T08:30:00.000Z");
const rng = extractEventDetails("Makeup lab", "EE makeup lab 2-5 pm in Dept EE Lab, Oct 17.");
assert.strictEqual(new Date(rng.start_time).getUTCMonth(), 9, "2-5 is a time range, Oct 17 is the date");
console.log("✓ Passed: academic years and time ranges are not mistaken for dates");

// Your own Cancel / Restore beats the computed class (and a notice's cancellation)
import { withPersonalOverrides } from "./src/lib/timetable/updates.ts";
const wk = [
  { title: "CH 111: Chemistry", start_time: "2026-10-19T06:00:00.000Z", is_cancelled: false },
  { title: "MA 105: Calculus", start_time: "2026-10-19T05:00:00.000Z", is_cancelled: true }, // cancelled by a notice
];
const mineSaved = [
  { title: "CH 111: Chemistry", start_time: "2026-10-19T06:00:00.000Z", is_cancelled: true },
  { title: "MA 105: Calculus", start_time: "2026-10-19T05:00:00.000Z", is_cancelled: false },
];
const merged = withPersonalOverrides(wk, mineSaved);
assert.strictEqual(merged.length, 2);
assert.strictEqual(merged.find((x) => x.title.startsWith("CH")).is_cancelled, true, "my cancel sticks");
assert.strictEqual(merged.find((x) => x.title.startsWith("MA")).is_cancelled, false, "my restore beats the notice");
assert.strictEqual(merged[0].title.startsWith("MA"), true, "sorted by time");
console.log("✓ Passed: your own cancel/restore survives reloads");

// The real CH 111 notice: event date is in the subject (Oct 16), the Moodle posting line says Oct 14
const ch = extractEventDetails(
  "CH 111-2026-1-D3: Quiz on Friday, October 16th: Logistics",
  "Quiz logistics by Prof X - Wednesday, 14 October 2026, 5:15 PM\nThe quiz will be held on 16TH OCTOBER at 8:30 AM in LA 201."
);
assert.strictEqual(new Date(ch.start_time).toISOString(), "2026-10-16T03:00:00.000Z", "Friday 16 Oct 8:30 IST, not the posting time");
// The exact real notice text (Moodle email): Friday 16 Oct, 5:15–6:15 PM
const realCh = extractEventDetails(
  "CH 111-2026-1-D3: Quiz on Friday, October 16th: Logistics",
  "CH 111-2026-1-D3 -> Forums -> Announcements -> Quiz on Friday, October\n16th: Logistics\nhttps://moodle.iitb.ac.in/mod/forum/discuss.php?d=8888#p11775\nQuiz on Friday, October 16th: Logistics\nby Shobhna Kapoor - Wednesday, 14 October 2026, 9:34 AM\n\nDear students,\n\nWe hope you are all preparing well for FRIDAY'S (16TH OCTOBER) Quiz.\n\n1)  EXAM TIMINGS AND SEATING ARRANGEMENT: The exam duration is 60 MIN\n(5:15 PM – 6:15 PM). Please occupy your seats between 4:45-4:55 PM as per\nthe SEATING ARRANGEMENT (ATTACHED) in this email."
);
assert.strictEqual(realCh.start_time, "2026-10-16T11:45:00.000Z", "Fri 16 Oct 17:15 IST");
assert.strictEqual(realCh.end_time, "2026-10-16T12:45:00.000Z", "ends 18:15 IST");
console.log("✓ Passed: posting time is never taken as the event date");

// A quiz is only added when the subject names one
const ref = new Date("2026-10-17T06:00:00Z");
assert.strictEqual(updateFromNotice("HS 109-2026-1-S1: Reading about Kant", "Read before the quiz on 29 October 2026 at 2 PM.", "k", ref), null);
assert.strictEqual(updateFromNotice("CS 105-2026-1-D3: Tutorial sheet on posets", "Practice for the quiz on 25 October 2026 at 9 AM.", "p", ref), null);
assert.strictEqual(updateFromNotice("MA 105 Quiz 3", "Quiz 3 on 23 October 2026 at 2 PM in LA 201.", "q", ref).kind, "added");
console.log("✓ Passed: only notices that name a quiz/exam add one to the timetable");

import { coursesForDivision } from "./src/lib/timetable/catalog.ts";
assert.deepStrictEqual(coursesForDivision("D3").map((c) => c.course_code).sort(), ["CH111", "CS101", "MA105"]);
assert.deepStrictEqual(coursesForDivision("D1").map((c) => c.course_code).sort(), ["BB101", "CH111", "MA105"]);
assert.deepStrictEqual(coursesForDivision("S1"), []);
assert.deepStrictEqual(coursesForDivision(null), []);
console.log("✓ Passed: a division's common first-year courses fill the timetable");

// ---- Buffer week: one notice switches off a whole stretch of classes ----
{
  const recv = new Date("2026-10-19T05:14:00Z"); // Monday
  const buf = updateFromNotice(
    "DE 109-2026-1-S1: Buffer Week | No regular classses this week",
    "Please note that this week is designated as the 2nd buffer week, meaning there will be no regular lectures scheduled (No Classes).\n\nYour next regular class will be on:\n 27/10/2026 \n 5:05 pm \n LH301",
    "buf",
    recv
  );
  assert.ok(buf, "buffer week notice recognised");
  assert.strictEqual(buf.kind, "cancelled");
  assert.strictEqual(buf.course_code, "DE 109");
  assert.strictEqual(buf.on_date, "2026-10-19");
  assert.strictEqual(buf.until_date, "2026-10-26", "runs to the day before the next class");
  const mk = (id, d, t) => ({ id, title: "DE 109: Visual design", start_time: `${d}T${t}:00+05:30`, slot_type: "lecture" });
  const slots = [mk("a", "2026-10-19", "09:00"), mk("b", "2026-10-22", "09:00"), mk("c", "2026-10-27", "17:05"), { id: "x", title: "MA 105: Calculus", start_time: "2026-10-20T08:30:00+05:30", slot_type: "lecture" }];
  const out = applyCourseUpdates(slots, [buf]);
  assert.deepStrictEqual(out.map((s) => !!s.is_cancelled), [true, true, false, false], "DE 109 off all week, others and the next class untouched");
  const next = updateFromNotice("PH 108: No classes next week", "No regular lectures next week.", "nw", recv);
  assert.strictEqual(next.on_date, "2026-10-26");
  assert.strictEqual(next.until_date, "2026-11-01");
  assert.strictEqual(updateFromNotice("Hostel 5 buffer week mess menu", "No classes this week for anyone", "z", recv), null, "no course, no change");
}
