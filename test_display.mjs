import assert from "node:assert";
import { cleanSubject, senderName, sourceLabel, greeting } from "./src/lib/display.ts";

console.log("Display helpers tests...");
assert.strictEqual(cleanSubject("[S.Events] Re: Subject: Invitation to witness Gyrations"), "Invitation to witness Gyrations");
assert.strictEqual(cleanSubject("[Bodhitree] [Forum - CS101A26] Lecture Attendance is Optional"), "Lecture Attendance is Optional");
assert.strictEqual(cleanSubject("MA 105-2026-1-ALL: Quiz 2 syllabus"), "Quiz 2 syllabus");
assert.strictEqual(cleanSubject("ENT101-2026-1: Graded Paper Viewing Session"), "Graded Paper Viewing Session");
assert.strictEqual(cleanSubject("[Ep2026] [Ep] [Allplus] RSAP Student Colloquium"), "RSAP Student Colloquium");
assert.strictEqual(cleanSubject("Hostel 16 students council nomination"), "Hostel 16 students council nomination");
assert.strictEqual(cleanSubject("[S.Events]"), "[S.Events]");
assert.strictEqual(senderName('"Joseph John (via IITB Moodle)" <noreply@moodle.iitb.ac.in>'), "Joseph John");
assert.strictEqual(senderName("Office Dean SA <dean.sa.office@iitb.ac.in>"), "Office Dean SA");
assert.strictEqual(senderName("pbhaumik@iitb.ac.in"), "Pbhaumik");
assert.strictEqual(senderName("WhatsApp: Hostel 16"), "Hostel 16");
assert.strictEqual(sourceLabel({ subject: "MA 105-2026-1-ALL: Quiz 2", source: "moodle" }), "Moodle · MA 105");
assert.strictEqual(sourceLabel({ subject: "[Bodhitree] [Forum - CS101A26] Lab", from_address: "Bodhitree <x@y>" }), "Bodhitree · CS 101");
assert.strictEqual(sourceLabel({ subject: "[S.Events] Workshop", from_address: "GS <g@iitb.ac.in>" }), "Student Events");
assert.strictEqual(sourceLabel({ subject: "[WhatsApp · Hostel 16] Water", from_address: "WhatsApp: Hostel 16", source: "whatsapp" }), "Hostel 16 · WhatsApp");
assert.strictEqual(greeting(new Date("2026-10-16T13:54:00Z")), "Good evening"); // 19:24 IST
assert.strictEqual(greeting(new Date("2026-10-16T03:00:00Z")), "Good morning");
console.log("✓ Passed: clean titles, sender names, source labels and greetings");
