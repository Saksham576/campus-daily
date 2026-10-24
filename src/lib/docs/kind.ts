/**
 * What kind of course file is this? Moodle groups files by week or by whatever the teacher named the folder;
 * students look for "the quiz papers", "the slides", "the tutorial sheets". The file's own name is the best clue,
 * then the Moodle item (module) it sits in, then its section.
 */
export type FileKind =
  | "Quiz & exam papers"
  | "Lecture slides & notes"
  | "Tutorials & problem sets"
  | "Lab material"
  | "Seating & batch lists"
  | "Announcements & course info"
  | "Reading & references"
  | "Other";

/** The order groups appear in. */
export const FILE_KINDS: FileKind[] = [
  "Quiz & exam papers",
  "Lecture slides & notes",
  "Tutorials & problem sets",
  "Lab material",
  "Seating & batch lists",
  "Announcements & course info",
  "Reading & references",
  "Other",
];

// Underscores and dots glue words together ("CH111_2025_Quiz_Mid-Sem.pdf"), so they become spaces first.
const plain = (s: string | null | undefined) => (s || "").replace(/[_.]+/g, " ").replace(/\s+/g, " ").trim();

const SEATING = /seat(?:ing)?[ -]?plan|student ?list|batch ?list|tutorial batch|course associates?/i;
const QUIZ = /\b(?:quiz(?:zes)?|mid-?sem|end-?sem|end sem|exams?|past[ -][\w -]{0,20}papers?|question papers?|model answers?|cribs?|rubrics?|answer ?keys?|marking scheme|tq ?\d+)\b/i;
const TUTORIAL = /\b(?:tut(?:orial)?s?|problems?|problem ?sets?|assignments?|worksheets?|practice)\b/i;
const LAB = /\b(?:labs?|experiments?|manuals?|journal|viva|sub-?groups?)\b/i;
const SLIDES = /\blec(?:t|ture)?s?\b|\blec(?:t|ture)?s?[ -]?\d|\bl ?\d{1,2}\b|\bslides?\b|\bnotes?\b|\bpptx?\b|\bweek ?\d+/i;
const INFO = /announce|syllabus|about ?\d*|course (?:plan|policy|outline|information)|schedule|logistics|notice|guidelines?|rules|regulations|format|list of/i;
// Folders of extra reading often also say "Previous Quiz Papers"; reading wins when a folder name is all we have.
const READING = /\b(?:readings?|references?|textbook|additional|extra material|something interesting)\b/i;
// A solution belongs with whatever it solves; on its own it goes with quizzes.
const SOLUTION = /\b(?:solutions?|answers?)\b/i;

const NAME_RULES: [FileKind, RegExp][] = [
  ["Seating & batch lists", SEATING],
  ["Quiz & exam papers", QUIZ],
  ["Tutorials & problem sets", TUTORIAL],
  ["Lab material", LAB],
  ["Lecture slides & notes", SLIDES],
  ["Announcements & course info", INFO],
  ["Quiz & exam papers", SOLUTION],
];

const CONTEXT_RULES: [FileKind, RegExp][] = [
  ["Seating & batch lists", SEATING],
  ["Reading & references", READING],
  ...NAME_RULES,
];

const firstMatch = (rules: [FileKind, RegExp][], text: string): FileKind | null => {
  if (!text) return null;
  for (const [kind, re] of rules) if (re.test(text)) return kind;
  return null;
};

export function fileKind(f: { name: string; module?: string | null; section?: string | null }): FileKind {
  const section = f.section && f.section !== "General" ? plain(f.section) : "";
  // A lab folder's "Lab Solutions" is lab material even though "solutions" alone would mean quizzes.
  return firstMatch(NAME_RULES, plain(f.name)) || firstMatch(CONTEXT_RULES, plain(f.module)) || firstMatch(CONTEXT_RULES, section) || "Other";
}
