import assert from "node:assert";
import { coursesFromShortnames } from "./src/lib/timetable/catalog.ts";

console.log("Moodle onboarding tests...");
const got = coursesFromShortnames(["CH 111-2026-1-D3", "CH 111-2026-1-ALL", "PH 117-2026-1-P16", "MA 105-2026-1-ALL", "NOCS01-2026-1", "XX 999-2026-1-D1"]);
const by = Object.fromEntries(got.map((c) => [c.course_code, c]));
assert.ok(by.CH111 && by.CH111.division === "D3", "division from the shortname");
assert.ok(by.PH117 && by.PH117.division === "P16" && by.PH117.lecture_slots.includes("L4"));
assert.strictEqual(by.MA105, undefined, "an -ALL page alone doesn't say the division");
assert.strictEqual(by.XX999, undefined, "unknown courses skipped");
console.log("✓ Passed: courses filled from Moodle divisions");

// Sign-in: IITB addresses, plus the owners with their personal address; nobody else.
{
  const { isAllowedEmail } = await import("./src/lib/auth.ts");
  assert.strictEqual(isAllowedEmail("26b2477@iitb.ac.in"), true);
  assert.strictEqual(isAllowedEmail("someone@cse.iitb.ac.in"), true);
  assert.strictEqual(isAllowedEmail("virajtiwari52@gmail.com"), true);
  assert.strictEqual(isAllowedEmail("VirajTiwari52@Gmail.com "), true);
  assert.strictEqual(isAllowedEmail("random@gmail.com"), false);
  assert.strictEqual(isAllowedEmail("virajtiwari52@gmail.com.evil.com"), false);
  console.log("✓ Passed: only IITB addresses and the owners can sign in");
}
