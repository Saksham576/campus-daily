import assert from "node:assert";
import { fileKind, FILE_KINDS } from "./src/lib/docs/kind.ts";

console.log("File kind tests...");
const Q = "Quiz & exam papers", S = "Lecture slides & notes", T = "Tutorials & problem sets", L = "Lab material", B = "Seating & batch lists", A = "Announcements & course info", R = "Reading & references";

// Real file names from the first-year courses (name, Moodle item, section) and what a student expects.
const cases = [
  // CH 111
  ["CH111_2025_Quiz_Mid-Sem.pdf", "Additionla Reading Materials, Previous Quiz Papers", "General", Q],
  ["CH111_2024_Endsem.pdf", "Additionla Reading Materials, Previous Quiz Papers", "General", Q],
  ["Atkins_study_material.pdf", "Additionla Reading Materials, Previous Quiz Papers", "General", R],
  ["Postulates_QM.pdf", "Additionla Reading Materials, Previous Quiz Papers", "General", R],
  ["Atkins_Chapter1_Problems.pdf", "Additionla Reading Materials, Previous Quiz Papers", "General", T],
  ["CH-111 2026 Model answers.pdf", "Organic and Inorganic cribs", "General", Q],
  ["CH111 Inorganic Chem Answers.pdf", "Organic and Inorganic cribs", "General", Q],
  ["CH111_End_Sem_2026.pdf", "Organic and Inorganic cribs", "General", Q],
  ["CH111 2026_Tutorial 5.pdf", "CH111 Physical Chemistry Tutorial", "General", T],
  ["CH 111 Tutorial 2 solutions.pdf", "Organic tutorials and old question papers", "General", T],
  ["Lecture 8 HA wavefunc_Shk_2026.pptx", "CH111 Physical Slides", "General", S],
  ["Lecture 2_Shk_2026.pdf.zip", "CH111 Physical Slides", "General", S],
  ["CH 111-2-2026.pdf", "Organic slides", "General", S],
  ["FMO-JCE.pdf", "Additional Reading Material", "General", R],
  ["cyclohexane_energy (Converted).mov", "Additional Reading Material", "General", R],
  // CS 101
  ["20261016121457481_CS101_Lab_Quiz_1_Solutions.pdf", "Lab Quiz 1", "A26 - Quizzes and Exams", Q],
  ["20261016121459857_A26_CS101_Midsem_Answers_Rubrics.pdf", "Midsem", "A26 - Quizzes and Exams", Q],
  ["20261016121454865_A26_CS101_TQ01.pdf", "Theory Quiz 1", "A26 - Quizzes and Exams", Q],
  ["20261016122133528_cs101-past-papers.zip", "Past CS101 Papers", "Past CS101 Papers and Practice", Q],
  ["lab-solutions.zip", "Lab Solutions", "Lab Solutions", L],
  ["CS101_2026_Tutorial_2_Solutions.docx", "Tutorial - Solutions", "Tutorials", T],
  ["20261016121726795_Tutorial_1_-_B_Solutions.pdf", "Tutorial 1 B - Solutions", "Tutorials", T],
  ["A26-CS101-Practice-Session-1.pdf", "Practice Session 1", "Lecture Slides", T],
  ["Lec1-2-AD.pdf", "Lec 1-2", "Lecture Slides", S],
  ["Lec-3rd-week.pdf", "Lec 5-6", "Lecture Slides", S],
  ["Week8x.pdf", "Arrays", "Lecture Slides", S],
  ["charArrays.pdf", "Chararacter Arrays and 2D Arrays", "Lecture Slides", S],
  ["Pointers.pdf", "Pointers", "Lecture Slides", S],
  ["20261016122149021_Pointers-extra.pdf", "Pointers (Extra material)", "Past CS101 Papers and Practice", R],
  ["20261016122151495_CS101_Something_Interesting_Part6.pdf", "Something Interesting -- III (Projected in Lab)", "Past CS101 Papers and Practice", R],
  // MA 105
  ["lecture_9.pdf", "Lecture 9 (post mid-sem, D2 and D4)", "19 October - 25 October", S],
  ["MA 105 P2-Lecture 13-wp.pdf", "Lecture 13 (post mid-sem): D1 and D3", "19 October - 25 October", S],
  ["L14.pdf", "Lecture 14-D2/D4", "7 September - 13 September", S],
  ["MA 105 Quiz 2_seat-plan.pdf", "Seating Plan for Quiz 2 on 23 October", "General", B],
  ["Seating_plan_midsem.pdf", "Seating Plan for the midsem exam", "General", B],
  ["StudentList_D4.pdf", "Tutorial Batch list_D4", "General", B],
  ["Studentloist_D2.pdf", "Tutorial Batch list_D2", "General", B],
  ["List_Course_Associate.pdf", "List of Couse Associates", "General", B],
  ["problem-set.pdf", "Problem set for Tutorials (post mid-sem)", "General", T],
  ["105_Assignment.pdf", "Problem Set for Tutorials", "General", T],
  ["Tutorial_schedule.pdf", "Schedule for Tutorials", "General", T],
  ["About105.pdf", "About the course", "General", A],
  // PH 117
  ["PH117 - End Sem Exam Slot Details.pdf", "End Sem Exam Slot Details", "19 October - 25 October", Q],
  ["PH 117 2026-27 Sem I - Journal Collection Notice.pdf", "Journal Collection Notice", "5 October - 11 October", L],
  ["1.Laser Interference.pdf", "Manuals", "27 July - 2 August", L],
  ["Error_analysis.pdf", "Manuals", "27 July - 2 August", L],
  ["P16 Sub-Group Details.pdf", "Sub-group details", "27 July - 2 August", L],
  ["3. Rules and regulations for Students.pdf", "Rules and regulations for students", "27 July - 2 August", A],
  // HS 108, ENT 101, SOM 101
  ["HS 108 L27.pdf", "Slides second-half", "General", S],
  ["Durkheim.pdf", "Readings second-half", "General", R],
  ["Quiz 1 Aug 26 key.pdf", "Readings", "General", Q],
  ["HS 108-S1-18-09-2026-1.pdf", "Mid Sem Exam Seating Plan", "General", B],
  ["Quiz 1_Rubrics_ENT101_July_2026-17.pdf", "Quiz-1 Rubrics (Set-A and Set-B)", "31 August - 6 September", Q],
  ["#22 Becoming a Good Communicator.pdf", "Lec 22 _ Being a Good communicator", "19 October - 25 October", S],
  ["#22 Project Briefing Final with Logistics.pdf", "Project Team Presentations - Logistics", "Project Work", A],
  ["Introduction to Management-Marketing1 (1).pptx", "Marketing", "31 August - 6 September", S],
  ["Schedule SOM101.docx", "SCHEDULE FOR GROUP PROJECT PRESENTATIONS", "24 August - 30 August", A],
  ["Finance Reads.docx", "Suggest Reading on Finance", "Suggested Readings for basic", R],
  ["index.html", "NOTICE: THIRD QUIZ ON 28TH OCTOBER", "28th october", Q],
];
const wrong = [];
for (const [name, module, section, want] of cases) {
  const got = fileKind({ name, module, section });
  if (got !== want) wrong.push(`${name}: got "${got}", want "${want}"`);
}
assert.deepStrictEqual(wrong, [], "\n" + wrong.join("\n"));

// Anything unrecognisable lands in Other, and every kind has a place in the order.
assert.strictEqual(fileKind({ name: "xyz.bin", module: "", section: null }), "Other");
assert.ok(FILE_KINDS.includes(fileKind({ name: "whatever.pdf" })));
assert.strictEqual(FILE_KINDS.length, 8);

const other = cases.filter(([n, m, s]) => fileKind({ name: n, module: m, section: s }) === "Other").length;
assert.ok(other / cases.length < 0.2, `too many Other: ${other}`);
console.log(`✓ Passed: ${cases.length} real file names sorted into the right group`);
