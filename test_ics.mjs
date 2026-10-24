import assert from "node:assert";
import { parseIcs, weeklyDates } from "./src/lib/timetable/ics.ts";

console.log("Calendar import tests...");
const win = { from: new Date("2026-10-19T00:00:00+05:30"), to: new Date("2026-11-30T00:00:00+05:30") };
const ics = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;
const ist = (iso) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16);

// One-off event with folded text and an escaped comma.
let r = parseIcs(
  ics(`BEGIN:VEVENT\r\nUID:a1\r\nDTSTART;TZID=Asia/Kolkata:20261022T143000\r\nDTEND;TZID=Asia/Kolkata:20261022T153000\r\nSUMMARY:Robotics\\, club meet\r\nLOCATION:SAC\r\n  Room 2\r\nEND:VEVENT`),
  win
);
assert.strictEqual(r.events.length, 1);
assert.strictEqual(r.events[0].title, "Robotics, club meet");
assert.strictEqual(ist(r.events[0].start), "2026-10-22T14:30");
assert.strictEqual(r.events[0].location, "SAC Room 2");

// UTC time becomes IST.
r = parseIcs(ics(`BEGIN:VEVENT\r\nUID:a2\r\nDTSTART:20261022T090000Z\r\nDTEND:20261022T100000Z\r\nSUMMARY:Call\r\nEND:VEVENT`), win);
assert.strictEqual(ist(r.events[0].start), "2026-10-22T14:30");

// Weekly on Mon and Wed until 11 Nov, one Wednesday skipped (EXDATE).
r = parseIcs(
  ics(`BEGIN:VEVENT\r\nUID:w1\r\nDTSTART;TZID=Asia/Kolkata:20261019T180000\r\nDTEND;TZID=Asia/Kolkata:20261019T190000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261111T235959Z\r\nEXDATE;TZID=Asia/Kolkata:20261028T180000\r\nSUMMARY:Gym\r\nEND:VEVENT`),
  win
);
assert.deepStrictEqual(
  r.events.map((e) => ist(e.start)),
  ["2026-10-19T18:00", "2026-10-21T18:00", "2026-10-26T18:00", "2026-11-02T18:00", "2026-11-04T18:00", "2026-11-09T18:00", "2026-11-11T18:00"]
);

// COUNT, and a moved single occurrence (RECURRENCE-ID) replaces the original.
r = parseIcs(
  ics(
    `BEGIN:VEVENT\r\nUID:c1\r\nDTSTART;TZID=Asia/Kolkata:20261020T100000\r\nDTEND;TZID=Asia/Kolkata:20261020T110000\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nSUMMARY:Study group\r\nEND:VEVENT\r\n` +
      `BEGIN:VEVENT\r\nUID:c1\r\nRECURRENCE-ID;TZID=Asia/Kolkata:20261027T100000\r\nDTSTART;TZID=Asia/Kolkata:20261027T160000\r\nDTEND;TZID=Asia/Kolkata:20261027T170000\r\nSUMMARY:Study group\r\nEND:VEVENT`
  ),
  win
);
assert.deepStrictEqual(r.events.map((e) => ist(e.start)), ["2026-10-20T10:00", "2026-10-27T16:00", "2026-11-03T10:00"]);

// Cancelled and all-day events are not imported.
r = parseIcs(
  ics(
    `BEGIN:VEVENT\r\nUID:x1\r\nDTSTART;TZID=Asia/Kolkata:20261022T100000\r\nSTATUS:CANCELLED\r\nSUMMARY:Gone\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:x2\r\nDTSTART;VALUE=DATE:20261023\r\nSUMMARY:Birthday\r\nEND:VEVENT`
  ),
  win
);
assert.strictEqual(r.events.length, 0);
assert.strictEqual(r.skipped, 1);

// Events outside the window are left out.
r = parseIcs(ics(`BEGIN:VEVENT\r\nUID:o1\r\nDTSTART;TZID=Asia/Kolkata:20250101T100000\r\nSUMMARY:Old\r\nEND:VEVENT`), win);
assert.strictEqual(r.events.length, 0);

// Another zone keeps its wall-clock time.
r = parseIcs(ics(`BEGIN:VEVENT\r\nUID:z1\r\nDTSTART;TZID=Europe/London:20261022T100000\r\nDTEND;TZID=Europe/London:20261022T110000\r\nSUMMARY:Call UK\r\nEND:VEVENT`), win);
assert.strictEqual(ist(r.events[0].start), "2026-10-22T14:30"); // 10:00 BST = 09:00 UTC = 14:30 IST

// Weekly dates for the add-slot form.
assert.deepStrictEqual(weeklyDates("2026-10-24", "2026-11-02", [0, 6]), ["2026-10-24", "2026-10-25", "2026-10-31", "2026-11-01"]);
console.log("Calendar import tests passed.");
