# Campus Daily — Feedback fix plan (25 Oct 2026)

Source: Saksham's handwritten list (points 1–18 plus page 2 points 14a/14b), a friend's WhatsApp feedback, and two screenshots (a friend's timetable and an Android push notification).

**Who this is for:** the model that will build these fixes. Follow it in order. Every task lists what the student meant, the cause found in the code or data, the files to change, what to change, and how to check it.

---

## 0. Rules for whoever builds this (read first)

1. **Repo:** `C:\Users\saksh\cdaily` (Next.js 16 App Router, Supabase project `bcqzlxftcsgjmgaddqjz`, Vercel). Live site: https://campusdaily.nexuspulsetech.com
2. **One PR per batch** (batches are in section 2). Flow for every batch:
   - `git checkout main && git pull`, then `git checkout -b fix/<batch-name>`
   - make the changes
   - `npx tsc --noEmit` must print nothing
   - `npm test` must exit 0 (check `echo $?`; the script runs `test_*.mjs` files)
   - `npm run build` must succeed
   - `git push -u origin HEAD`, `gh pr create --fill`, `gh pr merge --squash --delete-branch`, `git checkout main && git pull`
   - wait about 75 seconds, then confirm the deploy with `gh api repos/Saksham576/campus-daily/deployments --jq '.[0].sha'` followed by `gh api repos/Saksham576/campus-daily/deployments/<id>/statuses --jq '.[0].state'`. It must say `success`.
3. **Database changes:** add a new file `supabase/migrations/0036_<name>.sql` (then 0037, and so on). Apply it with the Supabase MCP `apply_migration` tool, using the same SQL. Never edit old migrations.
4. **Windows traps:**
   - Python is not installed. Use Node for scripts.
   - Bash heredocs break on quotes and backslashes. Write scripts with the Write tool into the scratchpad and run them with `node`.
   - Repo files use CRLF line endings. Edit with the Edit tool. If a script patches files, normalise `\r\n` first.
   - Importing a `.ts` file from a Node script needs a `file:///C:/Users/...` URL.
5. **Code style:** match the surrounding code. That means short comments explaining *why*, plain-English UI text (no jargon), no new libraries, and CSS appended to `src/app/globals.css` using the existing tokens (`var(--ink)`, `var(--line)`, and so on).
6. **Never** put secrets in chat or code. Never change `INSTAGRAM_TOKEN` or other Vercel env values.
7. **Add a test** for every logic change. Use the existing pattern: `test_relevance.mjs`, `test_ics.mjs` and `test_onboard.mjs` at the repo root, and add any new test file to the `test` script in `package.json`.
8. **When something here turns out wrong** (the code changed, or a cause doesn't reproduce): stop, write down what you found, and ask Saksham rather than guess.

---

## 1. What each note means (decoded)

| # | Handwritten note | Meaning | Task |
|---|---|---|---|
| 1–4 | Mess schedule, Wellness workshop, YT channel and Study material (quiz) → directly embedded in timetable | **Confirmed by Saksham:** (a) a new top-level **Mess** section (next to Home / Timetable / Files / Settings) with this week's menu per hostel; (b) each student's own wellness workshop sessions placed in their timetable (including Saturdays); (c) quizzes and exams placed in the timetable. Tapping one shows the seating plan and that subject's study material from Moodle, WhatsApp and Instagram, and the class block in the week *before* shows a small "Quiz next week" marker. **YT channel: do nothing for now.** | T13, T14, T15 |
| 5 | CS101 lab — the answers from AI should be curated for the particular student; Saksham didn't have CS105 | Ask-AI used other courses' data (CS105) in an answer about the CS101 lab. Answers must use only the student's own courses. | T6 |
| 6 | Section for quiz | A quiz list, but **the main requirement is the in-timetable version (T15)**; the list is secondary. | T15, T16 |
| 7 | Saturday, Sunday (even if no events) include in timetable; a way to show this is the current day | Always show Sat and Sun columns, and make today unmistakable. | T9 |
| 8a | Shrink the event details (only heading) | Event or notice entries in the timetable and lists show only the title until tapped. | T10 |
| 8b | Major events like institute ones were ignored (must) | Big institute events (Mood Indigo, Techfest, Inter-IIT, convocation, institute lectures) must appear even if not ticked. | T5 |
| 9 | Branch should decide division itself | First-years should not have to pick D1–D4; work it out from the branch. | T17 |
| 10 | 1st year → should choose default option directly | For first-years, pre-select the default (their division's offering) instead of asking. | T18 |
| 11 | PH lab not on Fri → still showing for me (screenshot) | The Friday "PH 117-2026-1-ALL" block is wrong. | T1 |
| 12 | Provide some option to not include certain information | Let students hide kinds of things (mess timings, weekends, Instagram, GC events, a sender, a topic). | T8 |
| 13 | Include B.Tech Dual degree | Add a programme choice (B.Tech, Dual Degree, B.S., M.Tech, M.Sc, PhD…) so year 5 makes sense. | T19 |
| 14 | EE103 is only a 1st-year course, can't be Core | **Confirmed by Saksham:** the picker shows EE103 with three choices (D4, Core and an elective-style option). EE103 is simply a first-year course, so there is nothing to choose: one tick, pre-ticked for the branch, in the student's division. | T18 |
| 15 | Why is NSS in Campus life? | **Struck out by Saksham. NSS stays in Campus life. Do nothing.** | — |
| 16 | I am getting messages of events I have not enrolled for (screenshot); only what I'm interested in should come | Phone alerts ("Campus Daily: important notice") go out for notices like the Filmmaking auditions. | T3 |
| 17 | "Pick my slots" button is not redirecting to the correct page | The Home nudge opens Settings on the wrong section. | T11 |
| 18 | Divide course files into structured sections, e.g. quiz paper + rubric, lecture slides, tutorial, announcements — refer to Moodle (CS101, MA105) and Bodhitree | The Files page should group by *type*, not by Moodle week. | T12 |
| p2 14a | Start and end time → timetable | Every block shows "14:00–15:30", not just "14:00". | T9 |
| p2 14b | Correct the classroom number, e.g. MA105 → (LT 704 X) | **Confirmed:** MA105 D3 should be LA 202 (the app shows LT 204). | T20 |
| WhatsApp | Got dance, Krittika and film-making notices I hadn't picked; they came because of "hostel" and "mess" | The relevance engine counts the word "hostel" in General Championship (GC) notices as a match. | T2 |

---

## 2. Batches (build in this order)

| Batch | Tasks | Why this order |
|---|---|---|
| A — wrong data students see now | T1, T2, T3, T4, T20 | Wrong exam blocks, wrong rooms and unwanted alerts damage trust most. (T20 = official rooms; it touches only `catalog.ts` + one data update.) |
| B — relevance and AI | T5, T6, T8 | Builds on T2. (T7 dropped.) |
| C — timetable display | T9, T10, T11 | Pure UI. |
| D — files | T12 | Needed by T15's study material. |
| E — exams in the timetable | T15, T16 | Saksham's top request among 1–4. |
| F2 — wellness | T14 | Needs the roster matching from T15. |
| G — Mess section | T13 | New data source; ask Q3 first. |
| F — onboarding | T17, T18, T19, T20 | Touches setup; test with a fresh account. |

---

## 3. Tasks

### T1 — A date range must not become a fake exam block (point 11)

**Evidence (from the database).** Notice `PH 117-2026-1-ALL: About endsem exam` (22 Oct) says the lab end-sem is "held during the week of 26–30 October". It created a `course_updates` row: `kind=added, slot_type=quiz, on_date=2026-10-30, new_start=10:00 IST, division=null`. Every PH 117 student therefore sees a 10:00–13:00 block on Friday 30 Oct. The friend's screenshot shows exactly this, labelled with the raw Moodle shortname.

**Cause.**
- `src/lib/events.ts` around line 240 picks "30 October" out of the range "26–30 October".
- Around line 302 it falls back to `startHour = 10` when the notice gives no time.
- `src/lib/timetable/updates.ts` around line 138 then adds a quiz or exam even though the notice has no time (`hasTime` is computed but not required).

**Fix.**
1. In `src/lib/timetable/updates.ts`, change the `added` branch for quiz, exam and deadline so it needs a real time for quiz and exam: `if ((ev.slot_type === "quiz" || ev.slot_type === "exam") && namesIt && !hasTime) return null;`. Deadlines may stay date-only.
2. In `src/lib/events.ts`, before the date matching, detect a range and treat it as having no single date: `/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:–|-|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|…|dec)/i` and `/\bweek of\b/i`. When a range is found, return no `start_time` (or mark it `range: true`) so nothing is placed on the grid.
3. Also check `eventCourseUpdate` in `src/lib/linking.ts` (line ~225, `kind === "assessment"`). It must not add a block when the resolved start came from a default time. Add a `timed: boolean` to the claim, or reuse the check from step 1.
4. Titles: when a slot title starts with a Moodle shortname (`/^[A-Z]{2,3} ?\d{3}-\d{4}-\d-[A-Z0-9]+:?\s*/`), show `PH 117 · About endsem exam` instead. Put this in the place that builds the slot title for `course_updates` of kind `added` (search for `title: ev.title`), or in `codeOf()` / the title display in `src/components/TimetableView.tsx`.
5. **Data clean-up** with `execute_sql`:
   - Delete the bad row: `delete from course_updates where title = 'PH 117-2026-1-ALL: About endsem exam' and new_start = '2026-10-30 04:30:00+00';`
   - **Do NOT delete Saksham's `PH 117: Physics Lab` rows** (Fri 16 and 23 Oct, 14:00–17:00). They are his real P16 labs. An earlier version of this plan said to delete them; that was a mistake.
6. **Test:** add cases to a new `test_events.mjs`.
   - "held during the week of 26–30 October" produces no update.
   - "Quiz 2 on 5 Nov at 5:15 pm in LA 001" produces an update at 17:15.
   - "Endsem on 30 October" with no time produces no update.

**Check:** the friend's week of 26–30 Oct no longer shows a Friday PH 117 block.

### T2 — GC notices must not pass because they say "hostel" (WhatsApp feedback)

**Evidence.** I replayed `relevanceOf` (`src/lib/relevance.ts`) with a first-year who ticked "Mess & hostel updates":
- "Astronomy General Championship … compete for hostel points" scored 4, which passes in focused mode, with the reason "Mess & hostel updates".
- "Come Support your Hostel at Freshiezza … Dance" scored 7 and passes.

The alias list `"mess & hostel updates": ["mess", "hostel"]` matches any mention of the word hostel. Every GC notice mentions hostels, because GC means inter-hostel competition.

**Fix in `src/lib/relevance.ts`.**
1. Make the alias specific: `"mess & hostel updates": ["mess menu", "mess rebate", "mess timing", "mess closed", "mess council", "hostel council", "hostel maintenance", "hostel office", "room allotment", "water supply", "wing", "hostel fee", "hostel gate"]`, plus a hostel-number rule (already handled by the hostel block).
2. Add `const GC_RE = /\b(general championship|\bGC\b|inter[- ]?hostel|hostel points|support your hostel|freshiezza)\b/i;`. When it matches the subject or summary:
   - ignore any keyword hit from "mess & hostel updates";
   - skip the `+4 Your hostel` bonus unless the text names the student's own hostel number;
   - the notice then counts only if one of the student's *activity* chips matches (Dance, Astronomy, Films, and so on).
3. Add an `astronomy` alias for "krittika", and a `films` alias for "silverscreen" and "filmmaking".
4. **Test:** extend `test_relevance.mjs` with the three real subjects above, for a focused first-year who ticked only "Mess & hostel updates" + "Robotics". All three must be `relevant: false`. The same Astronomy GC notice must be `true` for a student who ticked "Astronomy".

### T3 — Phone alerts only for notices that pass the student's own filter (point 16 + screenshot)

**Evidence.** `src/lib/server/publish.ts` sends "Campus Daily: important notice" to everyone whose AI score is `>= URGENT_SCORE` (8). It never calls `relevanceOf`, so the Filmmaking auditions buzzed students who never picked films.

**Fix.**
1. In `publishNotice`, add `categories, feed_mode, ncc_nso_nss, nso_activity` to the `subscribers` select and to the `Sub` type.
2. For non-timetable pushes, require both `score >= URGENT_SCORE` **and** `relevanceOf(row-as-RelItem, profileOf(sub)).relevant` with mode `focused`, whatever the student's own `feed_mode`. Alerts should be the strictest filter.
   - Build `profileOf` the same way `src/app/page.tsx` does (look for where it calls `relevanceOf`). Move that profile builder into `src/lib/relevance.ts` as `profileFromSubscriber(sub)` and use it in both places.
   - `myCourse`: set it when `sub.courses` includes a course code found in the subject.
3. Personal notices (`opts.only`) and timetable-change pushes keep their current behaviour.
4. **Test:** a unit test of `profileFromSubscriber` + `relevanceOf` on the Filmmaking notice for Saksham's profile gives `false`.

### T4 — Stop alerting for past or expired items (guard)

While in `publish.ts`: skip the push if the notice has a `deadline_at` in the past. This happens with re-ingested old mail. It's a small guard and goes in the same PR.

### T5 — Major institute events always reach everyone (point 8b)

In `src/lib/relevance.ts`, add `const MAJOR_RE = /\b(mood indigo|techfest|inter[- ]?iit|convocation|institute lecture|foundation day|independence day|republic day|e-summit|annual sports meet|institute holiday)\b/i;`. When it matches the subject:
- add `+4`, with the reason "Big campus event";
- never apply the year or hostel penalties to it.

Note: auditions or contingent selections *for* Inter-IIT are not the event itself. Exclude them with `/(audition|selection|trial|contingent|registration)/i`, which keeps T2 and T3 effective. **Test:** add cases.

### T6 — Ask AI uses only the student's own courses (point 5)

`src/app/api/ask/route.ts`:
- line ~45 reads `events` for **all** courses;
- line ~73 `search_docs` searches **all** documents.

That is how CS105 material reached Saksham, who doesn't take CS105.

**Fix.**
1. Build `const mine = new Set(courses.data.map(c => c.course_code.replace(/\s+/g, "")))`.
2. Filter `evs` to rows whose `course_code` is null or in `mine`.
3. Filter `search_docs` hits to those whose `course_code` is null or in `mine`. Request `lim: 12`, filter, then keep 6.
4. `course_files` is already limited by RLS to the student's Moodle courses; check this with a quick select as a non-owner. If not, filter it the same way.
5. Add to the prompt in `src/lib/ask.ts`: "The student takes only these courses: …. Never mention another course's material unless the student names it."

**Check:** with Saksham's courses, asking "when is CS101 lab" mentions no CS105 data.

### T7 — DROPPED

Saksham struck out point 15: NSS stays in "Campus life". **Do not change `INTEREST_GROUPS`.**

### T8 — Let students hide kinds of information (point 12)

Add a "Hide these" block to Settings → Interests (`src/app/settings/page.tsx`, panel `interests`):
- **Topics I don't want:** chips from the same `INTEREST_GROUPS`, plus "General Championships (GC)" and "Instagram posts". Store them in the existing column `subscribers.non_interests` (text, comma-separated, already in the table).
- **Senders I muted:** `subscribers.muted_senders` already exists. List the muted ones with an "Unmute" button. Check `ItemCard.tsx` for how muting is done today.
- **Timetable:** toggles for "Show mess timings", "Show weekends" and "Show events from notices". Store them in a new `subscribers.timetable_prefs jsonb default '{}'` (migration).

In `relevanceOf`, `non_interests` hits apply `-8` (a hard hide). Pass them in `Profile` as `avoid: string[]`. **Test:** a notice matching an avoided topic is not relevant even in balanced mode.

### T9 — Timetable: weekends, today, start and end times (points 7, p2-14a)

`src/components/TimetableView.tsx`:
1. Line ~140: Sat and Sun currently show "only in weeks where something is scheduled". Change it to always show 7 columns unless `timetable_prefs.weekends === false`. On desktop keep the grid readable: weekend columns can be narrower (`grid-template-columns: 56px repeat(5, 1fr) repeat(2, .7fr)`).
2. Today: the `.today` classes already exist. Make them obvious in `globals.css`:
   - a tinted column background (`color-mix(in srgb, var(--accent) 6%, transparent)`);
   - a filled pill on the day header with "Today";
   - on phone, the day strip's today chip filled.
   - Check both themes.
3. Start and end time: line ~270 shows `{hhmm(s.start_time)}`. Change it to `{hhmm(s.start_time)}{s.end_time ? `–${hhmm(s.end_time)}` : ""}` and keep the venue. For short blocks (`height <= 40`), show the times in one compact line instead of hiding them. The phone list (line ~318) already shows both; leave it.

### T10 — Events only show their heading (point 8a)

In the timetable grid and the Home "Today" list, entries that come from notices (`notice_id` set, or `slot_type` `event`/`session`) show **only the title**: one line, ellipsis. Time, venue and details appear in the Sheet when tapped, which already exists.

On Home (`src/components/ItemCard.tsx`), event cards show subject + date line only, and the summary when expanded. Check how cards expand now and reuse it; don't build a second mechanism.

### T11 — "Pick my slots" opens the right section (point 17)

**Cause.**
- The Home nudge links to `/settings#courses` (`src/app/page.tsx` line ~159).
- On phones, Settings shows one panel at a time using CSS `:target` (`globals.css` ~line 3196: `.settings .panel:target`).
- Next.js `<Link>` navigation uses `history.pushState`, which **does not update `:target`**. The page therefore opens on "You" (profile), not Courses.

**Fix.**
1. `SettingsRail` (`src/components/SettingsLayout.tsx`) already tracks `active` from the hash. Also write it to the page: `document.querySelector(".settings")?.setAttribute("data-panel", active)`.
2. Change the CSS to `.settings[data-panel="courses"] #courses` style rules. Simplest: `.settings[data-panel] .panel { display:none } .settings[data-panel] .panel.is-active { display:block }`. Toggle `is-active` from the same effect. Keep `:target` as the no-JS fallback.
3. After switching, call `document.getElementById(active)?.scrollIntoView({ block: "start" })` on desktop.
4. Do the same check for the other deep links: `/settings#interests`, `#moodle`, `#alerts`.

**Check:** in a 375px viewport, go Home, tap "Pick my slots", and the Courses panel shows. Do the same from the FeedView chip "My courses, labs and tutorials".

### T12 — Files grouped by type (point 18)

`src/components/LibraryView.tsx` groups one course by its Moodle `section` (week name). Add a type classifier `src/lib/docs/kind.ts`:

```ts
export type FileKind = "Quiz papers & solutions" | "Lecture slides & notes" | "Tutorials & problem sets" | "Labs" | "Announcements & admin" | "Other";
// Order matters: the first match wins. Match on `${name} ${module} ${section}`.
const RULES: [FileKind, RegExp][] = [
  ["Quiz papers & solutions", /\b(quiz|mid-?sem|end-?sem|exam|paper|solutions?|rubric|marking scheme|answer key)\b/i],
  ["Tutorials & problem sets", /\b(tut(orial)?s?|problem sets?|ps ?\d|assignment|worksheet|practice)\b/i],
  ["Labs", /\b(lab|experiment|manual|viva)\b/i],
  ["Lecture slides & notes", /\b(lec(ture)?s?|slides?|notes?|chapter|module|week ?\d+|ppt)\b/i],
  ["Announcements & admin", /\b(announce|syllabus|course (plan|policy|outline)|schedule|seating|attendance|grading|marks)\b/i],
];
```

1. Default view per course: groups by kind, in the order above, with a toggle "By week (as on Moodle)" for the old grouping.
2. Quiz papers and their rubric or solution sit together. Sort by a number in the name (`Quiz 2`, `Quiz 2 solution`).
3. Bodhitree (CS101) files: check whether they exist in `course_files` or `documents` (`select distinct source from documents`). If Bodhitree files aren't stored, note it as a follow-up and don't build a scraper now.
4. **Before shipping**, run the classifier on all of Saksham's files: `select name, module, section, course_code from course_files` for his courses. Print the counts per kind. "Other" should be under ~20%; tune the regexes if not.
5. **Test:** `test_kinds.mjs` with 10 real names from that query.

### T13 — A Mess section (point 1)

Saksham wants a **top-level Mess section**, a peer of Home / Timetable / Files / Settings (not a layer in the timetable).

**What it shows:**
- this week's menu (breakfast, lunch, snacks, dinner for each day) for the student's own hostel first;
- a hostel switcher for the other hostels we have data for;
- today highlighted, and the current meal on top;
- "Menu for Hostel X isn't available yet" when there's no data, with a "Send us your hostel's menu" button that writes to `feature_requests` (kind `"mess"`).

**Data. Order decided after checking on 25 Oct 2026:** Saksham compared InstiApp's Hostel 16 menu with the real mess. **It matches an earlier week, not the current one.** InstiApp is stale, so:
- **Primary source:** the hostel's weekly menu posted in its WhatsApp group (source 2 below). Saksham is connecting the forwarder number to the hostel groups.
- **Secondary:** admin paste or upload (source 3).
- **Fallback only:** InstiApp (source 1). Show it only when there is no WhatsApp or admin menu for that hostel and week, and always with the banner "From InstiApp. This may be an older week's menu." Never present it as current.

Build sources 2 and 3 first; add InstiApp last.

1. **InstiApp (fallback).** Its mess endpoint is public JSON and needs no login. Verified on 25 Oct 2026: `GET https://gymkhana.iitb.ac.in/instiapp/api/mess` (the old `api.insti.app/api/mess` redirects there).
   - **Shape:** an array of 22 hostels `{ id, name: "Hostel 16", short_name: "16", long_name: "Olympus", mess: [...] }`. Hostels 1–19, 21, "qip" and "tansa"; no Hostel 20.
   - Each `mess` entry is `{ id, day: 1..7, breakfast, lunch, snacks, dinner, hostel }`, with comma-separated items. Entries are **not** sorted by day.
   - **How InstiApp gets the menu.** From its source, `wncc/instiapp-api`, `messmenu/management/commands/mess_chore.py`: a scheduled job copies each hostel's Google Sheet (columns 1–7 = `day` 1–7) into the database, overwriting it. **The data has no date or week field.** If a hostel's mess council doesn't update its sheet, InstiApp keeps serving the old week. We can't tell "this week" from "an old week" by the API alone.
   - **Snapshot of 25 Oct 2026:** `docs/instiapp-mess-snapshot-2026-10-25.json`.
     - Hostels 1 and 9 have days with empty lunch and dinner.
     - Hostels 1 & 9, 12 & 13 & 14, and 7 & 8 & 21 have identical menus (shared messes, which is fine).
     - Hostel 16: `day 6` lunch is "Special Lunch" and dinner is empty.
   - **Freshness rules (must build):**
     1. The cron stores a hash of each hostel's menu in `mess_menus_meta (hostel, hash, first_seen_at, last_checked_at)`. `first_seen_at` changes only when the hash changes. That is "menu last changed".
     2. Under the menu, show "From InstiApp · last changed <date>".
     3. If a hostel's hash hasn't changed in 10+ days, show a muted banner: "This menu may be out of date. InstiApp hasn't changed it since <date>."
     4. A dated weekly menu from the hostel's WhatsApp group (source 2) **overrides** InstiApp for that hostel and week.
     5. A "Menu wrong?" button writes to `feature_requests` (kind `"mess"`, context `hostel:<n>`), so admins see which hostels are stale.
   - **Day numbering is not documented** (sheet column order). Saksham must confirm it once, comparing one meal with the real menu. Write the answer in a comment.
   - Fetch once a day from a cron route (`src/app/api/cron/mess/route.ts`, same auth as the other crons in `src/lib/server/cronAuth.ts`, plus an entry in the db cron schedule like the others) and upsert into `mess_menus`.
   - Show "Menu from InstiApp" under the menu. Never send any user data to it.
2. **The weekly WhatsApp menu message (PRIMARY).** WhatsApp messages are already ingested (`source = 'whatsapp'`), but only those that look like notices are stored. Today none mention a menu. Saksham is connecting the forwarder to the hostel groups.
   - **Menus are often an image or PDF.** WhatsApp attachments already arrive through `src/app/api/ingest/upload-url/route.ts` → `attachments` storage → `email.attachments` in `src/lib/server/ingestPipeline.ts`.
   - **Detect a menu *before* the "is this a notice?" filter,** so it isn't thrown away. Detect it when:
     - the text matches `/\b(mess )?menu\b/i` plus ≥3 day names or ≥3 of breakfast/lunch/snacks/dinner; or
     - the message is from a group whose name contains "Hostel" / "H<n>" / "Mess" and has an image or PDF attachment with a menu-like caption or file name.
   - **Extract with Gemini** (`src/lib/server/gemini.ts`). For an image, send the image itself; Gemini reads images. Use a strict JSON schema: `{ hostel: string|null, week_start: "YYYY-MM-DD"|null, days: [{ day: "Mon".."Sun", breakfast, lunch, snacks, dinner }] }`.
   - **Hostel:** take it from the group name ("Hostel 16") if the menu doesn't say.
   - **Week:** if the menu has no dates, use the Monday of the week the message was posted (if posted Fri–Sun, the following Monday). Store `source = 'whatsapp'` and `source_item`.
   - **Sanity check before saving:** at least 5 days with lunch or dinner filled in; otherwise save nothing and log it.
   - **Test:** `test_mess.mjs`, with one real text menu once one arrives, plus the date rule.
   - Add a parser: when a WhatsApp or email item looks like a weekly menu (`/\b(mess )?menu\b/i` plus ≥3 day names or ≥3 of breakfast/lunch/snacks/dinner), extract it into the table below with the existing Gemini helper (`src/lib/server/gemini.ts`). Use a strict JSON schema, and keep the source item id.
   - The text or image is often a photo; handle text first and leave images as a follow-up.
3. **Admin paste or upload (SECONDARY):** an `/admin` form "Mess menu". An admin picks the hostel and week, then pastes the text **or uploads the photo**. It is parsed the same way as source 2, and the admin sees a preview grid to fix before saving.

**Table (migration):** `mess_menus (hostel text, week_start date, day smallint check (day between 1 and 7), meal text check (meal in ('breakfast','lunch','snacks','dinner')), items text, source text, source_item text, updated_at timestamptz default now(), primary key (hostel, week_start, day, meal))`. Anyone signed in can read; only the service role and admins write.

**UI:**
- new route `src/app/mess/page.tsx`;
- add "Mess" to `src/components/AppBar.tsx` (icon `Utensils` from lucide-react, already a dependency);
- mobile layout: day tabs like the timetable's phone day strip.

### T14 — Each student's own wellness workshop sessions in the timetable (point 2)

**What Saksham said:** different students have different wellness sessions, so place each student's own sessions in their timetable, including Saturdays (T9 now always shows weekends).

**What the data looks like:** mails come from `wellness.workshops@iitb.ac.in`, sent to a list (not personal), for example "Wellness Workshop 3 – Sleep and Digital Wellbeing | Buffer 9" and "Wellness Workshop 1 – Substance Use Awareness | Buffer 10", with a date, time and room in the body.

**How to know whose session it is:**
1. If the mail has an attached list of students (roll numbers or names), the document pipeline already finds "your row" in class lists (`documents.is_roster`, `src/lib/server/docWorker.ts`; Ask uses it as "Your row in …").
   - Reuse that: when a wellness notice has a roster document containing the student's roll number (the part of their email before `@`), add a `user_schedules` row for that student only (`slot_type: "event"`, `origin: "notice"`, `notice_id` set).
2. If the mail has no list, it is an open or buffer session:
   - don't add it automatically;
   - show it in the notice card with the existing "Add to timetable" button (`ItemCard.tsx` ~line 291), and title the slot "Wellness: <topic> (buffer)".
3. **Before building:** open 2–3 recent wellness mails (`select body from items where sender ilike '%wellness%'`) and their attachments (`documents` joined on the item) to see where the assignment actually is. Write what you find at the top of the PR description. If it's in neither the mail nor an attachment, stop and ask Saksham where students see their own session.

### T15 — Quizzes and exams inside the timetable, with seating plan and study material (points 3, 4, 6)

**What Saksham said:**
- show quizzes and exams in the timetable;
- tapping one shows the student's seating plan (if uploaded) and that subject's study material from Moodle, WhatsApp and Instagram;
- the week **before** the quiz, that course's class blocks carry a small marker like "Quiz next week", which opens the same details.

This is the main deliverable; a separate list (T16) is only secondary. **No YouTube or channel links for now.**

1. **Quiz and exam blocks.** Sources:
   - `course_updates` (kind `added`, slot_type `quiz`/`exam`, which needs the T1 fix so only timed ones appear);
   - `moodle_deadlines` (kind quiz);
   - linked `events`.

   They already reach the week via the `buildWeek` / course-updates path. Make sure they render with their own style: an outline plus a small "Quiz" or "Exam" label, distinct from classes.
2. **"Quiz next week" marker.** In `TimetableView.tsx`, for each class block of course C in the visible week, check whether C has a quiz or exam in the 7–14 days after that block's date. If yes:
   - render a small pill inside the block ("Quiz · Mon 2 Nov"), max one per block;
   - tapping the pill opens the quiz Sheet (step 3), not the class Sheet;
   - also mark blocks in the same week *before* the quiz day.

   Pass the list of upcoming assessments into `TimetableView` from `src/app/schedule/page.tsx` (and Home's DayBoard if it's cheap).
3. **Quiz Sheet contents,** reusing the existing `Sheet` component:
   - **When and where:** date, start–end, room.
   - **Your seat:**
     - Look up roster documents (`documents.is_roster = true`) for that course whose text mentions the quiz (name or date). Find the student's row the same way `src/app/api/ask/route.ts` does for "Your row in …". Move that lookup into a shared helper in `src/lib/server/` and call it from a new API route `GET /api/quiz/seat?course=…&date=…` (signed-in user only, returns only *their* row).
     - Show the result in plain words: "LA 001, left row, seat J11". If there's no seating plan yet, show "Seating plan not uploaded yet."
   - **Study material for this course:**
     - Moodle files for that course from `course_files`, using T12's kinds. Show "Quiz papers & solutions" and "Lecture slides & notes" first, max 6, with "All files →" linking to `/library?course=<code>`.
     - Notices from any source (Moodle, email, WhatsApp, Instagram) for that course code from the last 30 days that look like material (`/\b(syllabus|portion|topics|practice|solutions?|notes|slides|reference|chapter)\b/i`). Use `me_feed` or `items` filtered by the course code in the subject or summary, max 5.
     - Show only courses the student takes.
4. **Example to check against:** an ENT 101 quiz next week. This week's ENT 101 blocks (Wed and Fri 08:00) show "Quiz · <date>". Tapping it shows the time, room, seat (if a list exists) and ENT 101 material.
5. **Test** in `test_quiz_marker.mjs`. The pure function `upcomingAssessmentFor(blockDate, course, assessments)` must:
   - return the quiz for a block 1–13 days before it;
   - return nothing for a different course;
   - return nothing after the quiz date.

### T16 — Quiz list (point 6, secondary)

Do this only after T15. Add a small "Upcoming quizzes & exams" list at the top of the Timetable page, collapsed to 3 items, for the student's courses only. Each row opens the same quiz Sheet as T15. Don't build a separate page or nav item.

### T17 — Branch decides the first-year division (point 9)

**Source of truth:** the official Academic Office timetable, "Time Table for Autumn Semester 2026-27, Ist Year B.Tech. / Dual Degree / 4 Yr. B.S." (https://acad.iitb.ac.in/sites/default/files/Autumn_TTC_26-27_09.07.2026.pdf), page 3, "Department combinations":

| Division | Branches (official) |
|---|---|
| D1 (307) | CH Chemistry (35), EN Energy Sc. & Engg. (41), ES Env. Sc. & Engg. (37), GP Geophysics (25), ME Mechanical (169) |
| D2 (284) | AE Aerospace (66), CE Civil (130), EP Engineering Physics (52), IE IEOR (36) |
| D3 (312) | EC Economics (40), CS Computer Sc. (170), MM Met. Engg. & Mat. Sc. (102) |
| D4 (301) | CL Chemical (113), EE Electrical (170), MA Mathematics (18) |

There is no first-year BSBE branch in the official list. A first-year who picks BSBE keeps the manual division select.

1. Add `DIVISION_BY_DEPARTMENT` to `src/lib/constants.ts`, keyed by the exact `DEPARTMENTS` strings.
   - `DEPARTMENTS` has "Physics" but the branch is **Engineering Physics**. Add `"Engineering Physics"` as its own entry (D2) and keep "Physics" for older students.
   - "Earth Sciences" is the GP / Geophysics branch (D1).
   - Store the PDF link in a comment beside the map.
2. In `src/components/WelcomeWizard.tsx` (division select ~line 250): for year 1, set `form.division` automatically when the department changes. Replace the select with a line "Division D3 (from your branch) · Change" so a student can still override it. If the branch is unknown, keep the select.
3. Also apply this in Settings → Profile for existing users with year 1 and an empty division.
4. **Test** in `test_onboard.mjs`: MEMS gives D3 and Electrical gives D4.

### T18 — First-years get defaults, not choices; one tick for EE103 (points 10, 14)

**Saksham's words:** the picker gives EE103 three options (D4, Core and an elective-style one), but EE103 is only a first-year core course, so there's nothing to choose.

**Cause.** `src/components/CoursePicker.tsx` builds the dropdown from every entry in the catalog's `divisions` (around line 170: `COURSE_CATALOG[key].divisions.map((d) => d.d)`). For EE103 that is `Core` and `D4`, plus the "not taking" choice.

`src/components/CoursePicker.tsx`:
1. For `firstYear`, render the branch's 1xx course (`deptCourses`, for example EE103) as **one checkbox, pre-ticked**, saved with the student's division (`D4`). Use `Core` only if the course has no `D*` offering. **No dropdown.**
2. Apply the same rule to every 1xx course whose catalog offerings are only `Core`, `Minor` and/or one `D*`: one checkbox, no choice.
3. **Default course set by division** (official PDF pages 3–5). Pre-tick these for a first-year and ask only for what truly differs:

   | Division | Pre-ticked | Ask only |
   |---|---|---|
   | D1 | CH 111, MA 105, BB 101, the branch's DIC (ME 103 / EN 110 / ES 101 / GP 101; Chemistry has none) | CH 117 + MS 101 batch (P1–P4) |
   | D2 | CH 111, MA 105, BB 101, the branch's DIC (AE 103 / CE 103 / PH 109 / IE 101) | CH 117 + MS 101 batch (P7–P10) |
   | D3 | CH 111, MA 105, CS 101, ENT 101, the branch's DIC (CS 105; EC, MM none) | PH 117 + CS 101 lab batch (P13–P16), HASMED course + section (S1/S2) |
   | D4 | CH 111, MA 105, CS 101, ENT 101, the branch's DIC (EE 103 / MA 113; CL none) | PH 117 + CS 101 lab batch (P19–P22), HASMED course + section (S1/S2) |

   - "HASMED" means HS 108 / HS 109 / SOM 101 / DE 109.
   - Ask for the lab batch **once**: the same P-number drives both labs.
   - HS 113 (English) is only for some students. Leave it unticked, with an "I take Academic English" checkbox.
   - Per the PDF: "Students who do BB101 in the Autumn Semester will do CS 101 in Spring & Vice Versa."

4. Labs (PH117, CH117, MS101) need the student's lab batch (P13…), which can't be guessed. Keep the question, but default to "Not sure yet" and show a hint: "Your lab batch (P13–P22) is on your Moodle course page name, e.g. PH 117-…-P16."
4. **Check** with a fresh test profile: Electrical, year 1 → EE103 (D4) pre-ticked, no "Core" option shown.

### T19 — Programme choice incl. Dual Degree (point 13)

1. Migration: `alter table subscribers add column if not exists program text;`
2. In `src/lib/constants.ts`: `PROGRAMS = ["B.Tech", "B.Tech + M.Tech Dual Degree", "B.S.", "B.Des", "M.Tech", "M.Sc", "MBA", "PhD", "Other"]`.
3. Add a select in `WelcomeWizard.tsx` (step 0, next to year) and in Settings → Profile.
4. Year choices depend on the programme: Dual Degree allows 1–5, B.Tech 1–4, M.Tech/M.Sc 1–2.
5. Relevance: treat notices mentioning "dual degree" or "DD" (`/\b(dual degree|\bDD\b|5[- ]year)\b/i`) as +3 for Dual Degree students and −3 for others. Add a test.

### T20 — Venue correction (point p2-14b)

**Confirmed by Saksham, and by the official PDF:** MA105 for D3 is in **LA 202**. The app shows LT 204.

**Bigger finding.** For the first-year common courses, the ResoBin-copied catalog stores a *tutorial* room as the lecture venue. The official Academic Office PDF (link in T17), pages 3–5, disagrees for several courses:

| Course | Div | Official lecture slots · venue · tutorial | Our catalog now |
|---|---|---|---|
| CH 111 | D1 | 2A,2B,2C · **LA 201** · X2 | LT 006 ✗ |
| CH 111 | D2 | 8A,8B · **LA 202** · X2 | LT 302 ✗ |
| CH 111 | D3 | 3A,3B,3C · LA 201 · **X2** | LA 201 ✓, tutorial missing ✗ |
| CH 111 | D4 | 9A,9B · **LA 202** · X1 | LT 004 ✗ |
| MA 105 | D1 | 3A,3B,3C · LA 202 · X3 | ✓ |
| MA 105 | D2 | 9A,9B · **LA 201** · X1 | LT 203 ✗ |
| MA 105 | D3 | 2A,2B,2C · **LA 202** · X1 | LT 204 ✗ |
| MA 105 | D4 | 8A,8B · **LA 201** · X2 | LT 206 ✗ |
| CS 101 | D3 / D4 | 7A,7B · LA 201 / 10A,10B · LA 202 | ✓ |
| BB 101 | D1 | 6A,6B · **LH 302** · 12A | LT 206 ✗ |
| BB 101 | D2 | 10A,10B · **LH 302** · X3 | LT 304 ✗ |
| AE 103 | — | 11A,11B · **IC 1** | empty |
| EN 110 | — | 1A,1B,1C · **ESE 103** | empty |
| GP 101 | — | 1A,1B,1C · **LT 304** | check |

Tutorial *rooms* depend on the tutorial batch (the PDF lists several LTs per division). Don't put a tutorial room on the block; show "Tutorial room: see your batch".

1. Add `OFFICIAL_FIRST_YEAR` in `src/lib/timetable/catalog.ts`, with the rows above typed from the PDF. Apply it **after** the ResoBin merge, so it wins. Add the comment `// Official Academic Office timetable, Autumn 2026-27 (Autumn_TTC_26-27_09.07.2026.pdf). Overrides ResoBin.`
2. Check the remaining rows against the PDF too: HS 108/109, SOM 101, DE 109 (LC 201/202/301/302), ENT 101 (LH 301), and the DIC table on page 5.
3. Fix existing students' saved courses. For each corrected (course, division), run `update user_courses set venue=<official> where replace(course_code,' ','')=<code> and division=<div>;`. Print the counts before and after.
4. Fix CH 111 D3's missing X2 tutorial in the catalog. Only add it to existing D3 students who have `tutorial_slots = '{}'`. Saksham's row already has X2.
5. Add the PDF link to the class Sheet's footnote: "Times and rooms: official IITB timetable".
3. Add a "Wrong room? Tell us" link in the class Sheet that writes to `feature_requests` (kind `"fix"`, context `"venue:<code>:<div>"`). That table already backs the admin "What students want next" list.

---

## 4. Questions for Saksham (ask before the batch that needs them)

1. ~~Q1 (T20)~~: answered. MA105 D3 is LA 202, and the official PDF agrees.
2. ~~Q2 (T17)~~: answered from the official PDF (table in T17).
3. ~~Q3 (T13)~~: answered. It's InstiApp, whose public API works. The only remaining check is the day numbering (see T13).
4. ~~Q4 YouTube links~~: not needed for now.
5. ~~Q5 (T1)~~: answered. The screenshot was an EE (D4) student, whose real PH 117 lab is Thursday morning: batch P21 = slots 1C,2C,3C, per the official PDF page 4, and shown correctly. The Friday block was the fake end-sem block from T1. The official PDF also confirms P16 = L4 = Friday 14:00–17:00, so `catalog.ts` lab batches are right.

---

## 5. Final check after all batches

- [ ] Friend's timetable for 26–30 Oct: no fake Friday PH block; Sat and Sun visible; today highlighted; blocks show "14:00–15:30 · LT 206".
- [ ] Focused first-year who ticked only "Mess & hostel updates": no GC, dance or film notices on For you, and no phone alerts for them.
- [ ] Ask "when is my CS101 lab?" mentions no other course.
- [ ] Home → "Pick my slots" on a phone opens Courses.
- [ ] Files for MA105 grouped into Quiz papers / Slides / Tutorials / Announcements.
- [ ] A course with a quiz next week shows "Quiz · <date>" on this week's class blocks. Tapping it shows the time, room, seat (or "not uploaded yet") and that course's material.
- [ ] The Mess section opens from the nav and shows your hostel's week, or a clear "not available yet".
- [ ] A wellness session assigned to you (via its list) appears in your timetable, including on Saturday.
- [ ] NSS is still in "Campus life" (unchanged).
- [ ] New sign-up as an Electrical first-year: division auto-set to D4, EE103 pre-ticked, no "Core" option; programme list includes Dual Degree.
- [ ] Settings → Interests has "Hide these", and hiding "Dance" removes dance notices.
- [ ] `npm test`, `tsc` and `build` all pass, and each PR's deploy shows `success`.
