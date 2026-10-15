import assert from "node:assert";
import { buildBroadcast } from "./src/lib/broadcast.ts";
import { takesCourse, baselineCourses } from "./src/lib/timetable/courses.ts";
import { needsReminder, todaysClasses, reminderEmail } from "./src/lib/reminder.ts";
import { applyCourseUpdates } from "./src/lib/timetable/updates.ts";

console.log("Launch feature tests (broadcast, courses, reminders)...");

// --- Courses
assert(baselineCourses("D1").has("MA 105"));
assert(baselineCourses("D2", "Management").size > 0);
assert.strictEqual(takesCourse({ division: "D1" }, "cs 101"), true);
assert.strictEqual(takesCourse({ division: "D3" }, "CS 101"), false);
assert.strictEqual(takesCourse({ division: "D3", keywords: "robotics, CS101" }, "CS 101"), true);

// --- Broadcast
const who = { user_id: "u1", name: "Prof. Rao", role: "Professor", department: "Mathematics" };
const now = new Date("2026-10-15T04:00:00Z");
assert("error" in buildBroadcast({ subject: "x", body: "" }, who, now));
assert("error" in buildBroadcast({ subject: "Quiz", body: "", action: "cancelled", course_code: "nope", date: "2026-10-23" }, who, now));
assert("error" in buildBroadcast({ subject: "Moved", body: "", action: "moved", course_code: "MA 105", date: "2026-10-23" }, who, now));

const plain = buildBroadcast({ subject: "Office hours moved", body: "Now Thursday 5 PM." }, who, now);
assert.strictEqual(plain.update, null);
assert.strictEqual(plain.row.is_verified, true);
assert.strictEqual(plain.row.source, "broadcast");
assert.strictEqual(plain.row.sender, "Prof. Rao (Professor, Mathematics) · Verified");

const cancel = buildBroadcast(
  { subject: "MA 105 cancelled", body: "", action: "cancelled", course_code: "ma105", date: "2026-10-23", time: "08:30" },
  who,
  now
);
assert.strictEqual(cancel.update.kind, "cancelled");
assert.strictEqual(cancel.update.course_code, "MA 105");
assert.strictEqual(cancel.update.match_start, "2026-10-23T03:00:00.000Z");
assert.strictEqual(cancel.update.verified, true);
assert.strictEqual(cancel.update.notice_id, cancel.row.id);

// Verified cancel flows into a student's timetable
const slots = [{ id: "a", title: "MA 105: Calculus", start_time: "2026-10-23T03:00:00.000Z", end_time: "2026-10-23T03:55:00.000Z", slot_type: "lecture" }];
const applied = applyCourseUpdates(slots, [cancel.update]);
assert.strictEqual(applied[0].is_cancelled, true);
assert.strictEqual(applied[0].verified, true);

const quiz = buildBroadcast(
  { subject: "Quiz 3", body: "", action: "added", course_code: "MA 105", date: "2026-10-23", time: "14:00", end_time: "15:00", new_location: "LA 201", slot_type: "quiz" },
  who,
  now
);
assert.strictEqual(quiz.update.new_start, "2026-10-23T08:30:00.000Z");
assert.strictEqual(quiz.update.new_end, "2026-10-23T09:30:00.000Z");
assert.strictEqual(quiz.row.venue, "LA 201");

// --- Reminders
const day = 86400000;
const t = new Date("2026-10-23T02:30:00Z"); // Friday 08:00 IST
const base = { email: "s@iitb.ac.in", name: "Asha Kumar", division: "D1", onboarded_at: "2026-09-01T00:00:00Z" };
assert.strictEqual(needsReminder({ ...base, last_seen_at: new Date(t - 4 * day).toISOString() }, t), true);
assert.strictEqual(needsReminder({ ...base, last_seen_at: new Date(t - 1 * day).toISOString() }, t), false);
assert.strictEqual(needsReminder({ ...base, last_seen_at: new Date(t - 5 * day).toISOString(), last_reminded_at: new Date(t - day).toISOString() }, t), false);
assert.strictEqual(needsReminder({ ...base, onboarded_at: null }, t), false);

const classes = todaysClasses(base, [{ course_code: "CS 101", kind: "cancelled", on_date: "2026-10-23" }], t);
assert.deepStrictEqual(classes.map((c) => c.course), ["CS 101", "CH 107"]); // D1 Friday
assert.strictEqual(classes[0].note, "Cancelled");

const mail = reminderEmail(base, classes, [{ subject: "Fee <deadline>", summary: "Pay by Monday" }]);
assert(mail.subject.includes("changed"));
assert(mail.html.includes("Hi Asha"));
assert(mail.html.includes("Fee &lt;deadline&gt;"), "escapes HTML");
assert(!mail.html.includes("<deadline>"));

console.log("✓ Passed: broadcasts, course lookup, timetable overrides and reminder emails verified");

// --- Log in vs Sign up
import { initialAuthMode, isNoAccountError } from "./src/lib/auth.ts";
assert.strictEqual(initialAuthMode(""), "signup");
assert.strictEqual(initialAuthMode("a=1; campus_has_account=1; b=2"), "login");
assert.strictEqual(initialAuthMode("campus_has_account=0"), "signup");
assert.strictEqual(isNoAccountError({ code: "otp_disabled", message: "Signups not allowed for otp" }), true);
assert.strictEqual(isNoAccountError({ message: "Signups not allowed for otp" }), true);
assert.strictEqual(isNoAccountError({ message: "Email rate limit exceeded" }), false);
assert.strictEqual(isNoAccountError(null), false);
console.log("✓ Passed: log in / sign up mode selection");
