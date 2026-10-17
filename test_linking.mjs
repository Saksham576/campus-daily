import assert from "node:assert";
import { claimFrom, matchScore, resolveClaims, eventCourseUpdate, titleTokens, trustOf } from "./src/lib/linking.ts";

console.log("Cross-source linking tests...");
const now = new Date("2026-10-17T06:00:00Z");

// The same MA 105 quiz from three places
const moodle = { id: "m1", source: "moodle", sender: "Moodle", subject: "MA 105-2026-1-ALL: Quiz 2 on 23 October", body: "Quiz 2 will be held on Friday 23 October 2026 at 5:15 PM in LA 201.", received_at: "2026-10-16T09:00:00Z" };
const mail = { id: "e1", source: "ingest-mail", sender: "Prof X <x@math.iitb.ac.in>", subject: "MA 105 Quiz 2 reminder", body: "Reminder: MA 105 Quiz 2 on 23 October 2026 at 5:15 PM in LA 201.", received_at: "2026-10-16T12:00:00Z" };
const wa = { id: "w1", source: "whatsapp", sender: "WhatsApp: MA105 D3", subject: "[WhatsApp · MA105 D3] MA 105 quiz 2 venue shifted to LH 101 on 23 Oct", body: "MA 105 quiz 2 on 23 October 2026 at 5:15 PM has been shifted to LH 101.", received_at: "2026-10-17T05:00:00Z" };

assert.strictEqual(trustOf(moodle), 3);
assert.strictEqual(trustOf(mail), 2);
assert.strictEqual(trustOf(wa), 1);

const cm = claimFrom(moodle, now), ce = claimFrom(mail, now), cw = claimFrom(wa, now);
assert.ok(cm && ce && cw, "all three are claims");
assert.strictEqual(cm.course_code, "MA 105");
assert.strictEqual(cm.kind, "assessment");
assert.strictEqual(cm.on_date, "2026-10-23");
const ev = { course_code: cm.course_code, kind: cm.kind, on_date: cm.on_date, tokens: cm.tokens };
assert.strictEqual(matchScore(ce, ev), "yes", "email joins the Moodle event");

assert.strictEqual(matchScore(cw, ev), "yes", "WhatsApp joins too");
const r = resolveClaims([cm, ce, cw]);
assert.strictEqual(r.venue, "LA 201", "Moodle (trusted) decides the venue");
assert.ok(r.conflicts.some((c) => c.field === "venue" && /LH\s?101/i.test(c.value) && c.source === "whatsapp"), "WhatsApp's different venue is shown as a conflict");
assert.strictEqual(r.sources.length, 3);

// Same trust, newer wins
const mail2 = { ...mail, id: "e2", subject: "MA 105 Quiz 2 venue change", body: "MA 105 Quiz 2 on 23 October 2026 at 5:15 PM will now be in LC 101.", received_at: "2026-10-17T04:00:00Z" };
const r2 = resolveClaims([ce, claimFrom(mail2, now)]);
assert.match(r2.venue, /LC\s?101/i, "newer email beats older email");

// Cancellation by the instructor wins
const cancel = { id: "m2", source: "moodle", sender: "Moodle", subject: "CH 111-2026-1-D3: No lecture on 20 October", body: "The CH 111 lecture on 20 October 2026 at 9:30 AM is cancelled.", received_at: "2026-10-17T03:00:00Z" };
const cc = claimFrom(cancel, now);
assert.strictEqual(cc.kind, "class");
assert.strictEqual(resolveClaims([cc]).cancelled, true);
const upd = eventCourseUpdate("abc", { course_code: "CH 111", kind: "class", on_date: cc.on_date }, resolveClaims([cc]), true);
assert.strictEqual(upd.kind, "cancelled");
assert.strictEqual(upd.notice_id, "abc", "hangs off the primary notice");

// Different courses / days never join
assert.strictEqual(matchScore({ ...ce, course_code: "CH 111" }, ev), "no");
assert.strictEqual(matchScore({ ...ce, on_date: "2026-10-24" }, ev), "no");

// Non-course events join by title on the same day
const t1 = { id: "s1", sender: "GS <g@iitb.ac.in>", subject: "[S.Events] Aavhan Orientation x Redbull Wings Cup | 18th October | 5:45 pm", body: "Orientation on 18 October 2026 at 5:45 PM, PC Saxena Auditorium", received_at: "2026-10-16T08:00:00Z" };
const t2 = { id: "s2", source: "whatsapp", sender: "WhatsApp: Hostel 16", subject: "[WhatsApp · Hostel 16] Aavhan orientation with Redbull Wings Cup tomorrow 5:45 pm", body: "Aavhan orientation Redbull Wings Cup on 18 October at 5:45 PM", received_at: "2026-10-17T08:00:00Z" };
const a = claimFrom(t1, now), b = claimFrom(t2, now);
assert.ok(a && b);
assert.notStrictEqual(matchScore(b, { course_code: a.course_code, kind: a.kind, on_date: a.on_date, tokens: a.tokens }), "no", "same event, two sources");
const t3 = { ...t2, id: "s3", subject: "Freshiezza registrations", body: "Freshiezza workshop on 18 October at 6 PM" };
assert.strictEqual(matchScore(claimFrom(t3, now), { course_code: null, kind: a.kind, on_date: a.on_date, tokens: a.tokens }), "no", "different event same day");

// Not a dated upcoming thing → no claim
assert.strictEqual(claimFrom({ id: "x", subject: "Hostel 16 council nominations", body: "Send your nominations." }, now), null);
assert.ok(titleTokens("[S.Events] Re: Quiz 2 on 23rd October").includes("quiz"));
console.log("✓ Passed: one event from Moodle + email + WhatsApp, trust-then-newest resolution, conflicts kept");

import { groupByEvent } from "./src/lib/linking.ts";
const items = [moodle, mail, wa, { id: "z", subject: "Unrelated", received_at: "2026-10-17T01:00:00Z" }];
const links = [{ item_id: "m1", event_id: "E" }, { item_id: "e1", event_id: "E" }, { item_id: "w1", event_id: "E" }];
const grouped = groupByEvent(items, links, [{ id: "E", resolved: r }]);
assert.deepStrictEqual(grouped.map((g) => g.id), ["m1", "z"], "one card per event, Moodle kept");
assert.strictEqual(grouped[0].linked.sources.length, 3);
assert.strictEqual(grouped[0].linked.venue, "LA 201");
assert.strictEqual(grouped[1].linked, undefined);
console.log("✓ Passed: notices about one event collapse into one card");

// Real false positives from the first backfill
assert.strictEqual(claimFrom({ id: "f1", source: "moodle", subject: "CS 101-2026-1-ALL: New file — Theory Quiz 1", body: "quiz1.pdf" }, now), null, "a file isn't an event");
assert.strictEqual(claimFrom({ id: "f2", subject: "MA 105-2026-1-ALL: MA105 Quizz", body: "MA 105-2026-1-ALL -> Forums -> Doubt Forum -> MA105 Quizz. In Q9 part 1 is checked" }, now), null, "doubt forum chatter");
assert.strictEqual(claimFrom({ id: "f3", subject: "CH 111-2026-1-D3: Crib session: Organic and Inorganic papers", body: "Crib session on 20 October 2026 at 6 PM in LA 202", received_at: "2026-10-17T01:00:00Z" }, now)?.kind === "assessment", false, "crib isn't a quiz");
import { updateFromNotice } from "./src/lib/timetable/updates.ts";
assert.strictEqual(updateFromNotice("CS 101 Quiz", "Quiz details are on Moodle.", "n", now), null, "no written date → no timetable change");
console.log("✓ Passed: files, doubt-forum posts, crib sessions and undated notices don't become events");

// General notices never change a timetable (room names aren't courses)
const club = claimFrom({ id: "g1", sender: "GS <g@iitb.ac.in>", subject: "[S.Events] Literati | Wordgames 101 | 13th October | LC101 | 6:30 pm", body: "Wordgames quiz on 13th October at 6:30 PM in LC 101", received_at: "2026-10-12T05:00:00Z" }, new Date("2026-10-12T06:00:00Z"));
assert.ok(club, "still an event");
assert.strictEqual(club.course_code, null);
assert.strictEqual(eventCourseUpdate("g1", { course_code: club.course_code, kind: club.kind, on_date: club.on_date }, resolveClaims([club]), false), null);
console.log("✓ Passed: only course rules change timetables");
