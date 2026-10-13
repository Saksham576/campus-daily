import assert from "node:assert";
import {
  extractEventDetails,
  generateIcs,
  getGoogleCalendarUrl,
} from "./src/lib/events.ts";
import {
  DIVISION_SLOTS,
  getSlotsForWeek,
} from "./src/lib/timetable/first_year_slots.ts";
import {
  DEPARTMENTS,
  HOSTELS,
  DIVISIONS,
  HASMED,
  CATEGORIES,
} from "./src/lib/constants.ts";

console.log("=== RUNNING CAMPUS DAILY TEST SUITE ===\n");

// --- Test 1: Event Extraction (Happy Path) ---
console.log("Test 1: Event extraction from quiz notice...");
const quizNotice = extractEventDetails(
  "MA 105 Quiz 2 Announcement",
  "Quiz 2 will be held on 23rd October at 2:00 PM in LA 201."
);
assert(quizNotice !== null, "Expected event to be detected");
assert.strictEqual(quizNotice.course_code, "MA 105");
assert.strictEqual(quizNotice.location, "LA 201");
assert.strictEqual(quizNotice.slot_type, "quiz");
assert.strictEqual(quizNotice.is_cancelled, false);
console.log("✓ Passed:", quizNotice.title);

// --- Test 2: Cancellation Detection ---
console.log("\nTest 2: Class cancellation detection...");
const cancelNotice = extractEventDetails(
  "CS 101 Lecture Cancelled",
  "Dear students, please note that tomorrow morning CS 101 lecture at 9:30 AM is cancelled due to dept meeting."
);
assert(cancelNotice !== null, "Expected cancelled event to be detected");
assert.strictEqual(cancelNotice.is_cancelled, true);
assert(cancelNotice.title.includes("CANCELLED"), "Title should reflect cancellation");
console.log("✓ Passed:", cancelNotice.title);

// --- Test 3: Non-Event Notice Rejection ---
console.log("\nTest 3: Non-event notice rejection...");
const nonEvent = extractEventDetails(
  "Hostel 16 Mess Council Minutes",
  "Attached are the minutes of the general body meeting held last month regarding mess rebate policies."
);
assert.strictEqual(nonEvent, null, "General notice should not be classified as a timetable event");
console.log("✓ Passed: Non-event ignored correctly");

// --- Test 4: RFC 5545 .ics Calendar File Generation ---
console.log("\nTest 4: RFC 5545 .ics generation...");
const ics = generateIcs({
  title: "PH 107 Quantum Physics Midsem",
  description: "Bring scientific calculator and ID card.",
  location: "Convocation Hall",
  start_time: "2026-10-25T09:30:00.000Z",
  end_time: "2026-10-25T12:30:00.000Z",
});
assert(ics.includes("BEGIN:VCALENDAR"), "ICS missing header");
assert(ics.includes("VERSION:2.0"), "ICS missing version");
assert(ics.includes("BEGIN:VEVENT"), "ICS missing event start");
assert(ics.includes("SUMMARY:PH 107 Quantum Physics Midsem"), "ICS missing summary");
assert(ics.includes("LOCATION:Convocation Hall"), "ICS missing location");
assert(ics.includes("DTSTART:20261025T093000Z"), "ICS DTSTART format invalid");
assert(ics.includes("DTEND:20261025T123000Z"), "ICS DTEND format invalid");
assert(ics.includes("END:VEVENT"), "ICS missing event end");
assert(ics.includes("END:VCALENDAR"), "ICS missing calendar end");
console.log("✓ Passed: Valid RFC 5545 iCalendar stream produced");

// --- Test 5: Google Calendar Web Link Generation ---
console.log("\nTest 5: Google Calendar URL generation...");
const gcalUrl = getGoogleCalendarUrl({
  title: "MA 105 Tutorial",
  location: "LT 101",
  start_time: "2026-10-23T08:30:00.000Z",
  end_time: "2026-10-23T09:25:00.000Z",
});
assert(gcalUrl.startsWith("https://calendar.google.com/calendar/render?"), "Invalid GCal URL base");
assert(gcalUrl.includes("action=TEMPLATE"), "Missing action param");
assert(gcalUrl.includes("text=MA+105+Tutorial") || gcalUrl.includes("text=MA%20105%20Tutorial"), "Missing title");
console.log("✓ Passed: Google Calendar URL correctly formatted");

// --- Test 6: IIT Bombay First Year Timetable Slots ---
console.log("\nTest 6: First-year division slots...");
assert(Array.isArray(DIVISION_SLOTS.D1) && DIVISION_SLOTS.D1.length > 5, "D1 slots missing");
assert(Array.isArray(DIVISION_SLOTS.D2) && DIVISION_SLOTS.D2.length > 3, "D2 slots missing");
const weekSlots = getSlotsForWeek("D1", new Date());
assert(weekSlots.length === DIVISION_SLOTS.D1.length, "Calculated week slots mismatch");
for (const s of weekSlots) {
  assert(Date.parse(s.start_datetime), `Invalid start datetime for slot ${s.title}`);
  assert(Date.parse(s.end_datetime), `Invalid end datetime for slot ${s.title}`);
  assert(new Date(s.end_datetime) > new Date(s.start_datetime), "End time must be after start time");
}
console.log(`✓ Passed: Verified ${weekSlots.length} week slots for Division D1`);

// --- Test 7: Constants & IITB Metadata ---
console.log("\nTest 7: Constants & IITB metadata sanity...");
assert(DEPARTMENTS.includes("Metallurgical Engineering & Materials Science (MEMS)"), "MEMS dept missing");
assert(DEPARTMENTS.includes("Computer Science & Engineering"), "CSE dept missing");
assert(HOSTELS.includes("Hostel 16"), "H16 missing");
assert(HOSTELS.includes("Tansa"), "Tansa missing");
assert(DIVISIONS.length === 4, "Should have D1 to D4");
assert(HASMED.includes("Entrepreneurship"), "Entrepreneurship HASMED missing");
assert(CATEGORIES.includes("Academics"), "Academics category missing");
console.log("✓ Passed: IITB metadata structures fully verified");

console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
