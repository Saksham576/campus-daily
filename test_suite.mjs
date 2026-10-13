import assert from "node:assert";
import {
  extractEventDetails,
  generateIcs,
  generateMultiEventIcs,
  getGoogleCalendarUrl,
  parseIcs,
  escapeIcsText,
} from "./src/lib/events.ts";
import {
  DIVISION_SLOTS,
  HASMED_SLOTS,
  getSlotsForWeek,
} from "./src/lib/timetable/first_year_slots.ts";
import {
  DEPARTMENTS,
  HOSTELS,
  DIVISIONS,
  HASMED,
  CATEGORIES,
} from "./src/lib/constants.ts";

console.log("=== RUNNING ENHANCED CAMPUS DAILY TEST SUITE ===\n");

// --- Test 1: Event Extraction & Exact Time Parsing (Quiz Notice) ---
console.log("Test 1: Event extraction and exact 2:00 PM time verification...");
const quizNotice = extractEventDetails(
  "MA 105 Quiz 2 Announcement",
  "Quiz 2 will be held on 23rd October at 2:00 PM in LA 201."
);
assert(quizNotice !== null, "Expected event to be detected");
assert.strictEqual(quizNotice.course_code, "MA 105");
assert.strictEqual(quizNotice.location, "LA 201");
assert.strictEqual(quizNotice.slot_type, "quiz");
assert.strictEqual(quizNotice.is_cancelled, false);

// Verify exact IST time (2:00 PM IST = 14:00 IST = 08:30 UTC)
const quizDate = new Date(quizNotice.start_time);
assert.strictEqual(quizDate.getUTCHours(), 8, "Start time should be 08:30 UTC (2:00 PM IST)");
assert.strictEqual(quizDate.getUTCMinutes(), 30, "Start time minute should be 30");
assert.strictEqual(quizDate.getUTCDate(), 23, "Day should be 23rd");
assert.strictEqual(quizDate.getUTCMonth(), 9, "Month should be October (0-indexed 9)");
console.log("✓ Passed: MA 105 QUIZ correctly parsed at 14:00 IST (08:30 UTC)");

// --- Test 2: Class Cancellation & Exact 9:30 AM Time Verification ---
console.log("\nTest 2: Class cancellation and exact 9:30 AM time detection...");
const cancelNotice = extractEventDetails(
  "CS 101 Lecture Cancelled",
  "Dear students, please note that tomorrow morning CS 101 lecture at 9:30 AM is cancelled due to dept meeting."
);
assert(cancelNotice !== null, "Expected cancelled event to be detected");
assert.strictEqual(cancelNotice.is_cancelled, true);
assert(cancelNotice.title.includes("CANCELLED"), "Title should reflect cancellation");
assert.strictEqual(cancelNotice.course_code, "CS 101");
assert.strictEqual(cancelNotice.slot_type, "lecture");

// Verify exact IST time (9:30 AM IST = 04:00 UTC)
const cancelDate = new Date(cancelNotice.start_time);
assert.strictEqual(cancelDate.getUTCHours(), 4, "Start time should be 04:00 UTC (9:30 AM IST)");
assert.strictEqual(cancelDate.getUTCMinutes(), 0, "Start time minute should be 00");
console.log("✓ Passed: CS 101 LECTURE (CANCELLED) correctly parsed at 09:30 IST (04:00 UTC)");

// --- Test 3: Non-Event Notice & False Cancellation Rejection ---
console.log("\nTest 3: Non-event notice rejection (including irrelevant cancellation words)...");
const nonEventMinutes = extractEventDetails(
  "Hostel 16 Mess Council Minutes",
  "Attached are the minutes of the meeting. Rebate applications cancelled before 5th are processed."
);
assert.strictEqual(
  nonEventMinutes,
  null,
  "General mess notice mentioning cancelled rebate should not be classified as a timetable event"
);

const nonEventGeneral = extractEventDetails(
  "Found keys near Gymkhana",
  "Someone left their hostel keys near the badminton court."
);
assert.strictEqual(nonEventGeneral, null, "Lost and found notice should not be a timetable event");
console.log("✓ Passed: Non-event notices correctly rejected without false positives");

// --- Test 4: Month-First Date Parsing & Venue Disambiguation ---
console.log("\nTest 4: Month-first date parsing ('October 23') & venue disambiguation...");
const monthFirstNotice = extractEventDetails(
  "Tutorial Session in LA 201",
  "Tutorial session on October 23 at 2:00 PM in LA 201."
);
assert(monthFirstNotice !== null, "Expected event to be detected");
assert.strictEqual(monthFirstNotice.location, "LA 201");
assert.notStrictEqual(monthFirstNotice.course_code, "LA 201", "LA 201 must not be treated as a course code!");
const mfDate = new Date(monthFirstNotice.start_time);
assert.strictEqual(mfDate.getUTCDate(), 23, "Day must be 23");
assert.strictEqual(mfDate.getUTCMonth(), 9, "Month must be October");
console.log("✓ Passed: Month-first date and venue disambiguation verified");

// --- Test 5: Time Range Parsing (Exam Duration) ---
console.log("\nTest 5: Time range parsing (9:30 AM to 12:30 PM)...");
const examNotice = extractEventDetails(
  "PH 107 Midsem Exam",
  "Midsem exam will take place on November 5 from 9:30 AM to 12:30 PM in Convocation Hall."
);
assert(examNotice !== null, "Expected exam notice to be detected");
assert.strictEqual(examNotice.slot_type, "exam");
assert.strictEqual(examNotice.course_code, "PH 107");
assert.strictEqual(examNotice.location, "Convocation Hall");
const exStart = new Date(examNotice.start_time);
const exEnd = new Date(examNotice.end_time);
assert.strictEqual(exStart.getUTCHours(), 4, "Start 04:00 UTC (9:30 AM IST)");
assert.strictEqual(exEnd.getUTCHours(), 7, "End 07:00 UTC (12:30 PM IST)");
console.log("✓ Passed: PH 107 EXAM 3-hour duration range correctly extracted");

// --- Test 6: RFC 5545 Escaping & .ics Generation ---
console.log("\nTest 6: RFC 5545 .ics generation & special character escaping...");
const ics = generateIcs({
  title: "PH 107, Physics Lab; Group A",
  description: "Bring scientific calculator; lab coats mandatory, no exceptions.",
  location: "Convocation Hall; Dept Lab, Room 1",
  start_time: "2026-10-25T09:30:00.000Z",
  end_time: "2026-10-25T12:30:00.000Z",
});
assert(ics.includes("BEGIN:VCALENDAR"), "ICS missing header");
assert(ics.includes("VERSION:2.0"), "ICS missing version");
assert(ics.includes("BEGIN:VEVENT"), "ICS missing event start");
assert(ics.includes("SUMMARY:PH 107\\, Physics Lab\\; Group A"), "ICS SUMMARY must escape commas and semicolons");
assert(ics.includes("LOCATION:Convocation Hall\\; Dept Lab\\, Room 1"), "ICS LOCATION must escape commas and semicolons");
assert(ics.includes("DTSTART:20261025T093000Z"), "ICS DTSTART format invalid");
assert(ics.includes("DTEND:20261025T123000Z"), "ICS DTEND format invalid");
assert(ics.includes("END:VEVENT"), "ICS missing event end");
assert(ics.includes("END:VCALENDAR"), "ICS missing calendar end");
console.log("✓ Passed: Valid RFC 5545 iCalendar stream with compliant escaping");

// --- Test 7: Multi-Event .ics Generation with Weekly Recurrence ---
console.log("\nTest 7: Multi-Event .ics generation with weekly recurrence (RRULE)...");
const multiIcs = generateMultiEventIcs([
  {
    title: "MA 105: Calculus",
    location: "LA 201",
    start_time: "2026-10-19T03:00:00.000Z",
    end_time: "2026-10-19T03:55:00.000Z",
    rrule: "FREQ=WEEKLY;UNTIL=20261205T183000Z",
  },
  {
    title: "CS 101: Computer Programming",
    location: "LA 201",
    start_time: "2026-10-20T04:00:00.000Z",
    end_time: "2026-10-20T05:25:00.000Z",
    rrule: "FREQ=WEEKLY;UNTIL=20261205T183000Z",
  },
]);
assert(multiIcs.includes("RRULE:FREQ=WEEKLY;UNTIL=20261205T183000Z"), "Must include weekly recurrence rule");
assert(multiIcs.match(/BEGIN:VEVENT/g).length === 2, "Must contain exactly 2 events");
console.log("✓ Passed: Multi-event semester recurring calendar stream generated");

// --- Test 8: Moodle iCal Parser (RFC 5545 Stream Ingestion) ---
console.log("\nTest 8: Moodle iCal feed parsing...");
const sampleMoodleIcs = `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//Moodle//IIT Bombay//EN\r
BEGIN:VEVENT\r
UID:moodle-assign-201\r
DTSTART:20261028T182900Z\r
DTEND:20261028T182900Z\r
SUMMARY:CS 101 Programming Assignment 3 is due\r
DESCRIPTION:Submit tarball to Moodle\r
CATEGORIES:Assignment\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:moodle-quiz-301\r
DTSTART:20261030T090000Z\r
DTEND:20261030T100000Z\r
SUMMARY:MA 105 Online Quiz 3\r
DESCRIPTION:Attempt on Moodle portal\r
CATEGORIES:Quiz\r
END:VEVENT\r
END:VCALENDAR`;

const moodleEvents = parseIcs(sampleMoodleIcs);
assert.strictEqual(moodleEvents.length, 2, "Should parse 2 events from Moodle feed");
assert.strictEqual(moodleEvents[0].course_code, "CS 101");
assert.strictEqual(moodleEvents[0].slot_type, "deadline");
assert.strictEqual(moodleEvents[0].uid, "moodle-assign-201");
assert.strictEqual(moodleEvents[1].course_code, "MA 105");
assert.strictEqual(moodleEvents[1].slot_type, "quiz");
console.log("✓ Passed: Moodle assignment & quiz deadlines correctly parsed");

// --- Test 9: Google Calendar Web URL Generation ---
console.log("\nTest 9: Google Calendar URL generation...");
const gcalUrl = getGoogleCalendarUrl({
  title: "MA 105 Tutorial",
  location: "LT 101",
  start_time: "2026-10-23T08:30:00.000Z",
  end_time: "2026-10-23T09:25:00.000Z",
});
assert(gcalUrl.startsWith("https://calendar.google.com/calendar/render?"), "Invalid GCal URL base");
assert(gcalUrl.includes("action=TEMPLATE"), "Missing action param");
assert(gcalUrl.includes("dates=20261023T083000Z%2F20261023T092500Z") || gcalUrl.includes("dates=20261023T083000Z"), "Dates missing");
console.log("✓ Passed: Google Calendar URL correctly formatted");

// --- Test 10: Division & HASMED Elective Timetable Integration ---
console.log("\nTest 10: First-year division slots with HASMED elective...");
assert(Array.isArray(DIVISION_SLOTS.D1) && DIVISION_SLOTS.D1.length > 5, "D1 slots missing");
assert(Array.isArray(HASMED_SLOTS.Entrepreneurship) && HASMED_SLOTS.Entrepreneurship.length === 2, "Entrepreneurship elective missing");

const d1Only = getSlotsForWeek("D1", new Date());
const d1WithHasmed = getSlotsForWeek("D1", new Date(), "Entrepreneurship");
assert.strictEqual(
  d1WithHasmed.length,
  d1Only.length + HASMED_SLOTS.Entrepreneurship.length,
  "Schedule with HASMED must include division slots + elective slots"
);
console.log(`✓ Passed: Verified D1 timetable (${d1Only.length} base slots) + Entrepreneurship HASMED (${d1WithHasmed.length} total slots)`);

// --- Test 11: Constants & IITB Metadata Sanity ---
console.log("\nTest 11: Constants & IITB metadata sanity...");
assert(DEPARTMENTS.includes("Metallurgical Engineering & Materials Science (MEMS)"), "MEMS dept missing");
assert(DEPARTMENTS.includes("Computer Science & Engineering"), "CSE dept missing");
assert(HOSTELS.includes("Hostel 16"), "H16 missing");
assert(HOSTELS.includes("Tansa"), "Tansa missing");
assert(DIVISIONS.length === 4, "Should have D1 to D4");
assert(HASMED.includes("Entrepreneurship"), "Entrepreneurship HASMED missing");
assert(CATEGORIES.includes("Academics"), "Academics category missing");
console.log("✓ Passed: IITB metadata structures fully verified");

console.log("\n=== ALL 11 TEST SUITES PASSED SUCCESSFULLY! ===");
