import assert from "node:assert";
import { parseResobinTimetable } from "./src/lib/resobin.ts";

console.log("ResoBin import tests...");
const real = [
  { id: 11004, course: "CH111", division: "D3", lecture_slots: ["3A", "3B", "3C"], tutorial_slots: [], lecture_venue: "LA 201", professor: "X" },
  { id: 11926, course: "PH117", division: "P16", lecture_slots: ["L4"], tutorial_slots: [], lecture_venue: "" },
  { course: "<script>", division: "D1", lecture_slots: ["1A"] },
  { course: "MA105", division: "D3", lecture_slots: ["2A", "bad slot!", "2B"], tutorial_slots: ["X1"], lecture_venue: "LT 204<b>" },
  { course: "XX999", division: "D1", lecture_slots: [] },
];
const out = parseResobinTimetable(real);
assert.deepStrictEqual(out.map((c) => c.course_code), ["CH111", "PH117", "MA105"]);
assert.strictEqual(out[0].title, "Chemistry");
assert.strictEqual(out[1].venue, null);
assert.deepStrictEqual(out[2].lecture_slots, ["2A", "2B"], "junk slots dropped");
assert.strictEqual(out[2].venue, "LT 204b", "markup stripped");
assert.deepStrictEqual(parseResobinTimetable({ not: "array" }), []);
console.log("✓ Passed: ResoBin rows are validated before saving");
