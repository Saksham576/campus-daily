import assert from "node:assert";
import { digestPush, digestEmail } from "./src/lib/digest.ts";

console.log("Morning digest tests...");
const classes = [
  { time: "08:30", course: "MA 105", title: "Calculus", location: "LA 201" },
  { time: "09:30", course: "CH 111", title: "Chemistry", location: "LA 201", note: "Cancelled" },
];
const due = [{ title: "CS 101: Lab 6", due_at: "2026-10-18T18:29:00Z", kind: "assign" }];
const exams = [{ title: "MA 105: Quiz 2", due_at: "2026-10-23T11:45:00Z", kind: "quiz" }];
const p = digestPush(classes, due, exams);
assert.strictEqual(p.title, "Timetable changed today");
assert.match(p.body, /1 class from 08:30/);
assert.match(p.body, /CH 111 cancelled/);
assert.match(p.body, /1 due this week \(next: CS 101: Lab 6/);
assert.match(p.body, /MA 105: Quiz 2 on Fri, 23 Oct/);
assert.strictEqual(digestPush([], [], []), null, "nothing to say → no push");
const m = digestEmail("Saksham Tiwari", classes, due, exams);
assert.match(m.html, /Good morning Saksham/);
assert.ok(!m.html.includes("<script"), "escaped");
assert.strictEqual(digestEmail("A", [{ time: "1", course: "<b>", title: "", location: "" }], [], []).html.includes("<b><b>"), false);
console.log("✓ Passed: morning digest push and email");
