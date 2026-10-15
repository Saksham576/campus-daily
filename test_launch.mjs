import assert from "node:assert";
import { buildBroadcast } from "./src/lib/broadcast.ts";
import { takesCourse } from "./src/lib/timetable/courses.ts";
import { buildWeek } from "./src/lib/timetable/slots.ts";
import { needsReminder, todaysClasses, reminderEmail } from "./src/lib/reminder.ts";
import { applyCourseUpdates } from "./src/lib/timetable/updates.ts";

console.log("Launch feature tests (broadcast, courses, reminders)...");

// --- Courses (from Settings -> My courses)
assert.strictEqual(takesCourse({ courses: ["MA105", "CS101"] }, "cs 101"), true);
assert.strictEqual(takesCourse({ courses: ["MA105"] }, "CS 101"), false);
assert.strictEqual(takesCourse({ courses: [], keywords: "robotics, CS101" }, "CS 101"), true);

// Saksham's real week (ResoBin, 12-16 Oct 2026)
const saksham = [
  { course_code: "CH111", title: "Chemistry", lecture_slots: ["3A", "3B", "3C"], tutorial_slots: [], venue: "LA 201" },
  { course_code: "CS101", title: "Computer Programming and Utilization", lecture_slots: ["7A", "7B"], tutorial_slots: [], venue: "LA 201" },
  { course_code: "DE109", title: "Introduction to Design", lecture_slots: ["12A", "12B", "12C"], tutorial_slots: [], venue: "LC 302" },
  { course_code: "ENT101", title: "Introduction to Innovation & Entrepreneurship", lecture_slots: ["5A", "5B"], tutorial_slots: [], venue: "LH 301" },
  { course_code: "MA105", title: "Calculus", lecture_slots: ["2A", "2B", "2C"], tutorial_slots: ["X1"], venue: "LT 204" },
  { course_code: "PH117", title: "Physics Lab", lecture_slots: ["L4"], tutorial_slots: [], venue: null },
];
const wk = buildWeek(saksham, new Date("2026-10-15T10:00:00Z"));
const ist = (iso) => new Date(new Date(iso).getTime() + 5.5 * 3600e3).toISOString().slice(5, 16).replace("T", " ");
const mon = wk.filter((s) => ist(s.start_time).startsWith("10-12")).map((s) => `${ist(s.start_time).slice(6)} ${s.title.split(":")[0]}`);
assert.deepStrictEqual(mon, ["10:30 MA 105", "11:30 CH 111", "17:00 DE 109"]);
const wed = wk.filter((s) => ist(s.start_time).startsWith("10-14")).map((s) => `${ist(s.start_time).slice(6)} ${s.title.split(":")[0]}`);
assert.deepStrictEqual(wed, ["08:00 ENT 101", "11:00 CS 101", "14:00 MA 105"]);
assert(wk.some((s) => s.title === "MA 105: Calculus (Tutorial)"), "MA105 tutorial X1 on Wednesday");
const fri = wk.filter((s) => ist(s.start_time).startsWith("10-16"));
assert.deepStrictEqual(fri.map((s) => s.slot_type), ["lecture", "lecture", "lab"]);
assert.strictEqual(wk.length, 15, "15 sessions, same as ResoBin's week view");
assert(!wk.some((s) => /MS 101|CS 105/.test(s.title)), "no courses he isn't registered for");

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

const classes = todaysClasses(saksham, [{ course_code: "CS 101", kind: "cancelled", on_date: "2026-10-23" }], t);
assert.deepStrictEqual(classes.map((c) => `${c.time} ${c.course}`), ["08:00 ENT 101", "11:00 CS 101", "14:00 PH 117"]); // Friday
assert.strictEqual(classes[1].note, "Cancelled");

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

// --- App-sent sign-in email
import { buildSigninEmail, rateLimitReason } from "./src/lib/signinEmail.ts";
const se = buildSigninEmail("123456", "https://campusdaily.nexuspulsetech.com/auth/confirm?token_hash=abc&type=email&next=%2F");
assert.strictEqual(se.subject, "123456 is your Campus Daily code");
assert(se.html.includes(">123456<") && se.html.includes("/auth/confirm?token_hash=abc") && se.text.includes("123456"));
const nowRL = new Date("2026-10-15T10:00:00Z");
assert.strictEqual(rateLimitReason([], nowRL), null);
assert(rateLimitReason(["2026-10-15T09:59:45Z"], nowRL).includes("30 seconds"));
assert(rateLimitReason(["09:10", "09:20", "09:30", "09:40", "09:50"].map((m) => `2026-10-15T${m}:00Z`), nowRL).includes("hour"));
assert.strictEqual(rateLimitReason(["2026-10-15T08:00:00Z"], nowRL), null);
console.log("✓ Passed: sign-in email content and rate limits");
