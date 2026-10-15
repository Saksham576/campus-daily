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
