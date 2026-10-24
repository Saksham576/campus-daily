import assert from "node:assert";
import { relevanceOf, profileFromSubscriber } from "./src/lib/relevance.ts";
import { courseSet, isOtherCourse, namesOnlyOtherCourses, buildAskPrompt } from "./src/lib/ask.ts";

console.log("Batch B tests...");
const p = { categories: ["Academics"], keywords: ["Robotics"], hostel: "Hostel 16", year: "1", mode: "focused" };

// T5: the institute's big events reach everyone; auditions or registrations for them do not.
const mi = { subject: "Mood Indigo 2026 dates announced", summary: "Mood Indigo, Asia's largest college cultural festival, returns in December.", tags: ["Fests & Cultural"] };
assert.ok(relevanceOf(mi, p).relevant, "Mood Indigo reaches a focused student with other interests");
assert.strictEqual(relevanceOf(mi, p).why, "Big campus event");
assert.ok(relevanceOf({ subject: "Convocation 2026: schedule and dress code", summary: "", tags: [] }, p).relevant);
assert.ok(relevanceOf({ subject: "Institute holiday on 2 November", summary: "", tags: [] }, p).relevant);
assert.strictEqual(relevanceOf({ subject: "Mood Indigo auditions for the choir", summary: "", tags: ["Fests & Cultural"] }, p).relevant, false, "an audition for it is not the event");
assert.strictEqual(relevanceOf({ subject: "[S.Events] Inter-IIT Filmmaking Auditions 2026", summary: "Contingent selection for Inter-IIT Cultural Meet 9.0", tags: ["Fests & Cultural"] }, p).relevant, false);
// A big event for another hostel's year does not lose points for it.
assert.ok(relevanceOf({ subject: "Techfest 2026: hostel 3 volunteers needed", summary: "", tags: [] }, p).relevant);

// T8: topics the student hides are gone, even if they follow something that matches.
const hide = (avoid, keywords = ["Dance"]) => ({ ...p, keywords, avoid });
const dance = { subject: "[S.Events] Group Dance Auditions | Open For All", summary: "InSync Dance Club auditions", tags: ["Fests & Cultural"] };
assert.ok(relevanceOf(dance, hide([])).relevant, "followed, not hidden");
assert.strictEqual(relevanceOf(dance, hide(["Dance"])).relevant, false, "hidden wins over followed");
assert.strictEqual(relevanceOf(dance, { ...hide(["Dance"]), mode: "everything" }).relevant, false, "hidden even in everything mode");
const gc = { subject: "[S.Events] Astronomy General Championship 2026", summary: "Compete for hostel points", tags: [] };
assert.strictEqual(relevanceOf(gc, hide(["General Championships (GC)"], ["Astronomy"])).relevant, false, "the GC chip hides championships");
assert.ok(relevanceOf(gc, hide([], ["Astronomy"])).relevant);
const ig = { subject: "Ready to spike, serve, and soar", summary: "Volleyball", tags: ["Sports"], source: "instagram" };
assert.strictEqual(relevanceOf(ig, hide(["Instagram posts"], ["Volleyball"])).relevant, false, "Instagram posts can be hidden");
// Never hide the student's own mail, Moodle or courses.
assert.ok(relevanceOf({ ...dance, is_personal: true }, hide(["Dance"])).relevant);
assert.ok(relevanceOf({ ...dance, source: "moodle" }, hide(["Dance"])).relevant);
assert.ok(relevanceOf({ ...dance, myCourse: "ENT 101" }, hide(["Dance"])).relevant);
assert.deepStrictEqual(profileFromSubscriber({ non_interests: "Dance, Instagram posts" }).avoid, ["Dance", "Instagram posts"]);
assert.deepStrictEqual(profileFromSubscriber({}).avoid, []);

// T6: Ask uses only the student's own courses.
const mine = courseSet(["CH111", "CS 101", "ENT-101", "MA105", "PH117"]);
assert.ok(mine.has("CS101") && mine.has("ENT101"));
assert.strictEqual(isOtherCourse("CS 105", mine), true, "CS 105 is not taken");
assert.strictEqual(isOtherCourse("CS 101", mine), false);
assert.strictEqual(isOtherCourse(null, mine), false, "no course means not another course");
assert.strictEqual(isOtherCourse("CS 105", new Set()), false, "with no known courses nothing is filtered");
assert.strictEqual(namesOnlyOtherCourses("CS 105: Discrete Structures quiz 2", mine), true);
assert.strictEqual(namesOnlyOtherCourses("[Bodhitree] [Forum - CS101A26] Doubt Solving Session", mine), false, "CS101A26 reads as CS101");
assert.strictEqual(namesOnlyOtherCourses("[Bodhitree] [Forum - CS105A26] Quiz", mine), true);
assert.strictEqual(namesOnlyOtherCourses("MA 105 and CS 105 quiz timings", mine), false, "one of yours is named");
assert.strictEqual(namesOnlyOtherCourses("Quiz in LA 201 at 5 pm", mine), false, "rooms are not courses");
assert.strictEqual(namesOnlyOtherCourses("Hostel 16 water supply", mine), false);
const prompt = buildAskPrompt("when is my lab", { now: new Date("2026-10-25T00:00:00Z"), notices: [], classes: [], deadlines: [], files: [], myCourses: ["CH111", "CS101"] });
assert.match(prompt, /takes only these courses: CH111, CS101/);

console.log("✓ Passed: big events, hide list and Ask limited to your courses");
