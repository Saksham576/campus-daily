import assert from "node:assert";
import { relevanceOf, parseKeywords } from "./src/lib/relevance.ts";

console.log("Relevance tests...");
const base = { tags: [], score: 6 };
const me = { categories: ["Academics", "Sports", "Talks & Seminars", "Competitions / Hackathons", "Fests & Cultural", "Placements / Internships", "Hostel / Campus Life"], keywords: [], hostel: "Hostel 16", year: "1", mode: "balanced" };

const scholarship = { ...base, subject: "Tuition Fee Support Scholarships | Deadline extended", summary: "UG students with family income up to 25 lakh can apply." };
const mockGd = { ...base, subject: "Mock Interviews & Group Discussions | Alumination 2026", summary: "Register for mock interviews with alumni." };
const hostel16 = { ...base, subject: "[WhatsApp · Hostel 16] Water off 2-4 PM", from_address: "WhatsApp: Hostel 16" };
const hostel4 = { ...base, subject: "Hostel 4 mess closed tomorrow", from_address: "WhatsApp: Hostel 4" };
const robotics = { ...base, subject: "ERC Summer of Bots orientation", summary: "Electronics and Robotics Club" };
const secondYear = { ...base, subject: "Second year students: department elective form" };
const fresher = { ...base, subject: "Orientation for freshers tonight" };
const regn = { ...base, subject: "Course registration opens Monday", summary: "All UG students must register." };
const course = { ...base, subject: "MA 105 quiz", myCourse: "MA 105" };
const personal = { ...base, subject: "Your hostel room", is_personal: true };

// A student who chose nothing only sees what concerns everyone or them.
assert.strictEqual(relevanceOf(scholarship, me).relevant, false, "generic scholarship is not for you");
assert.strictEqual(relevanceOf(mockGd, me).relevant, false, "generic event is not for you");
assert.strictEqual(relevanceOf(regn, me).relevant, true, "course registration concerns everyone");
assert.strictEqual(relevanceOf(course, me).relevant, true);
assert.strictEqual(relevanceOf(personal, me).relevant, true);
assert.strictEqual(relevanceOf(hostel16, me).relevant, true, "own hostel");
assert.strictEqual(relevanceOf(hostel4, me).relevant, false, "other hostel");
assert.strictEqual(relevanceOf(secondYear, me).relevant, false, "second-year notice for a fresher");
assert.strictEqual(relevanceOf(fresher, me).relevant, true, "freshers notice for a fresher");
assert.strictEqual(relevanceOf(fresher, { ...me, year: "3" }).relevant, false, "freshers notice for a third year");

// Choosing clubs lifts those notices, with a reason.
const withRobotics = { ...me, keywords: ["Robotics"] };
const r = relevanceOf(robotics, withRobotics);
assert.strictEqual(r.relevant, true);
assert.strictEqual(r.why, "Robotics");
assert.strictEqual(relevanceOf(robotics, me).relevant, false, "no interest chosen, no robotics");

// Topics only count when they are a real choice (all seven ticked means nothing).
const tagged = { ...base, subject: "Inter-hostel football trials", tags: ["Sports"] };
assert.strictEqual(relevanceOf(tagged, { ...me, categories: ["Sports"] }).relevant, true);
assert.strictEqual(relevanceOf(tagged, me).relevant, false);

// Focus levels.
assert.strictEqual(relevanceOf(mockGd, { ...me, mode: "everything" }).relevant, true);
assert.strictEqual(relevanceOf(hostel16, { ...me, mode: "focused" }).relevant, true);
assert.strictEqual(relevanceOf(regn, { ...me, mode: "focused" }).relevant, false, "focused wants a personal signal");

assert.deepStrictEqual(parseKeywords("robotics,  chess ,"), ["robotics", "chess"]);
console.log("Relevance tests passed.");
