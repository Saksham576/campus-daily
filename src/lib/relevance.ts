/**
 * Is this notice for THIS student? Scores a notice against what the student told us (clubs, interests,
 * topics, hostel, year) and what we know (their courses). Home's "For you" shows only what clears the bar
 * set by the student's own focus choice; everything else stays one tap away in "Explore".
 */

export type FeedMode = "focused" | "balanced" | "everything";

export type Profile = {
  categories: string[];
  keywords: string[];
  hostel?: string | null;
  department?: string | null;
  year?: string | null;
  mode: FeedMode;
};

export type RelItem = {
  subject: string;
  summary?: string | null;
  body?: string | null;
  tags?: unknown;
  from_address?: string | null;
  source?: string | null;
  is_personal?: boolean | null;
  is_verified?: boolean | null;
  score?: number | null;
  myCourse?: string | null;
};

export type Relevance = { points: number; relevant: boolean; why: string | null };

/** The bar a notice must clear to appear in For you. */
export const BAR: Record<FeedMode, number> = { focused: 4, balanced: 2, everything: 0 };

/** Words that find the same thing as a chip's label (club nicknames, spellings). Keys are lower-case. */
const ALIASES: Record<string, string[]> = {
  robotics: ["robotics", "robot", "erc", "electronics and robotics"],
  "web & coding club": ["web and coding", "web & coding", "webclub", "coding club", "wncc"],
  "quant club": ["quant", "quantitative"],
  "quant & finance": ["quant", "finance", "trading", "fintech"],
  "finance club": ["finance", "fincell", "investment"],
  "e-cell": ["e-cell", "ecell", "e-summit", "entrepreneurship cell", "startup"],
  "startups & e-cell": ["e-cell", "ecell", "e-summit", "startup", "entrepreneur"],
  "mood indigo": ["mood indigo", "moodi", "mood-i"],
  techfest: ["techfest", "tech fest"],
  aeromodelling: ["aeromodelling", "aero modelling", "aeromodeling", "aero club"],
  "mars rover": ["mars rover", "mars-rover"],
  "hyperloop": ["hyperloop"],
  astronomy: ["astronomy", "astro club", "telescope", "krittika"],
  "analytics club": ["analytics", "data science", "kaggle"],
  insight: ["insight"],
  music: ["music", "band", "singing", "jam"],
  dramatics: ["dramatics", "drama", "theatre", "theater", "play"],
  dance: ["dance", "choreo"],
  photography: ["photography", "photo club", "pfc", "film and media"],
  films: ["film", "cinema", "screening", "movie", "silverscreen"],
  literary: ["literary", "litsoc", "poetry", "writing", "creative writing"],
  quizzing: ["quiz club", "quizzing", "quizzes", "q-club"],
  debating: ["debate", "debating", "parliamentary", "mun"],
  nss: ["nss", "national service scheme"],
  "placements & internships": ["placement", "internship", "intern ", "recruit", "hiring", "career"],
  "consulting": ["consulting", "case competition", "case comp", "mckinsey", "bcg", "bain"],
  "product & tech roles": ["product management", "software", "sde", "swe", "tech role", "product role"],
  "core engineering": ["core", "mechanical", "civil", "chemical", "metallurgy", "aerospace"],
  "research & higher studies": ["research", "gre", "gate", "higher studies", "masters", "phd", "ra position", "urop"],
  "orientation & freshie events": ["orientation", "freshie", "freshers", "fresher", "welcome"],
  "hackathons & coding contests": ["hackathon", "coding contest", "codeforces", "competitive programming", "cp "],
  "sports trials & nso": ["trials", "selection", "nso", "pre-camp", "inter-hostel", "inter hostel"],
  "scholarships & fee notices": ["scholarship", "fee waiver", "fee support"],
  // Specific on purpose: every inter-hostel championship says "hostel", and none of them is a hostel update.
  "mess & hostel updates": ["mess menu", "mess rebate", "mess timing", "mess closed", "mess council", "mess fee", "mess secretary", "hostel council", "hostel maintenance", "hostel office", "hostel gate", "room allotment", "water supply", "hostel warden", "hostel secretary"],
  cricket: ["cricket"],
  football: ["football", "soccer"],
  basketball: ["basketball"],
  badminton: ["badminton"],
  "table tennis": ["table tennis", "tt "],
  chess: ["chess"],
  swimming: ["swimming", "pool"],
  athletics: ["athletics", "track and field", "marathon"],
  "fitness & gym": ["gym", "fitness", "yoga"],
  "wellness & counselling": ["wellness", "counselling", "counseling", "mental health", "swc", "student wellness"],
  "lost & found": ["lost", "found"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (s: string) => new RegExp(`(^|[^a-z0-9])${escape(s.trim()).replace(/\s+/g, "\\s+")}`, "i");
const patternsFor = (kw: string) => (ALIASES[kw.trim().toLowerCase()] || [kw]).map(wordRe);

/** Things every student needs regardless of interests. */
const INSTITUTE_RE =
  /\b(course registration|add[- ]?drop|semester fee|fee (payment|payable|due|deadline)|hostel (allotment|room allotment|fee)|academic calendar|time ?table|end[- ]?sem(ester)?|mid[- ]?sem(ester)?|institute holiday|classes (are )?(suspended|cancelled)|mandatory|convocation|id card|medical insurance)\b/i;

const ORDINAL: Record<string, string> = { first: "1", "1st": "1", second: "2", "2nd": "2", third: "3", "3rd": "3", fourth: "4", "4th": "4", final: "4", fifth: "5", "5th": "5" };
const YEAR_RE = /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|final)[- ]year(s)?\b/gi;
const FRESHER_RE = /\b(freshers?|freshies|freshmen|newly admitted|ug ?2026|btech ?2026|b\.tech 2026|class of 2030)\b/i;

const hostelNumbers = (text: string) => {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b(?:hostel|hostels|h)\s?-?(\d{1,2})\b/gi)) out.add(String(Number(m[1])));
  return out;
};
const myHostelNumber = (hostel?: string | null) => {
  const m = (hostel || "").match(/(\d{1,2})/);
  return m ? String(Number(m[1])) : null;
};

/** Inter-hostel championships (GC): they are about winning points for a hostel, so the word "hostel" says nothing about the student. */
const GC_RE = /\b(general championship|inter[- ]?hostel|hostel points|support your hostel|freshiezza|\d+ GC points|GC 20\d\d)\b/i;
const HOSTEL_UPDATE_CHIP = "mess & hostel updates";

const tagsOf = (t: unknown): string[] => (Array.isArray(t) ? t.map(String) : []);

export function relevanceOf(item: RelItem, p: Profile): Relevance {
  const subject = item.subject || "";
  const rest = `${item.summary || ""}\n${(item.body || "").slice(0, 1200)}\n${item.from_address || ""}`;
  const reasons: string[] = [];
  let points = 0;

  if (item.is_personal) points += 10;
  if (item.is_verified) points += 6;
  if (item.source === "moodle") points += 6;
  if (item.myCourse) points += 6;

  // Clubs, interests and topics the student chose.
  const isGC = GC_RE.test(`${subject}
${(item.summary || "").slice(0, 400)}`);
  let hits = 0;
  for (const kw of p.keywords) {
    if (isGC && kw.trim().toLowerCase() === HOSTEL_UPDATE_CHIP) continue;
    const pats = patternsFor(kw);
    const inSubject = pats.some((r) => r.test(subject));
    const inRest = !inSubject && pats.some((r) => r.test(rest));
    if (inSubject || inRest) {
      points += inSubject ? 4 : 2;
      if (hits++ < 2) reasons.push(kw);
    }
  }
  // Ticking every topic says nothing, so it is ignored.
  if (p.categories.length > 0 && p.categories.length < 7) {
    const mine = tagsOf(item.tags).filter((t) => p.categories.includes(t));
    if (mine.length) {
      points += 2;
      if (!reasons.length) reasons.push(mine[0]);
    }
  }

  // Hostel: yours lifts it, someone else's sinks it.
  const hn = myHostelNumber(p.hostel);
  const seen = hostelNumbers(`${subject}\n${item.from_address || ""}\n${(item.summary || "").slice(0, 300)}`);
  if (hn && seen.size) {
    if (seen.has(hn)) {
      points += 4;
      reasons.push("Your hostel");
    } else points -= 5;
  }

  // Year: "second year" notices are not for a fresher.
  if (p.year) {
    const text = `${subject}\n${(item.summary || "").slice(0, 300)}`;
    const years = new Set([...text.matchAll(YEAR_RE)].map((m) => ORDINAL[m[1].toLowerCase()]));
    if (years.size) {
      if (years.has(String(p.year))) points += 2;
      else points -= 4;
    } else if (FRESHER_RE.test(text)) {
      if (String(p.year) === "1") {
        points += 3;
        reasons.push("For freshers");
      } else points -= 3;
    }
  }

  if (INSTITUTE_RE.test(`${subject}\n${(item.summary || "").slice(0, 400)}`)) {
    points += 3;
    if (!reasons.length) reasons.push("Affects all students");
  }
  if ((item.score ?? 0) >= 9) points += 1;

  return { points, relevant: points >= BAR[p.mode], why: reasons.length ? reasons.slice(0, 2).join(" · ") : null };
}

const squash = (s: string) => s.toUpperCase().replace(/[\s-]/g, "");

/**
 * Should a phone buzz for this notice? Only urgent notices are considered (the caller checks that), and then only
 * what is theirs: their own mail, their Moodle courses, or what clears the strictest filter on what they follow.
 * Notices whose deadline has already passed never buzz.
 */
export function worthAnAlert(
  item: RelItem & { deadline_at?: string | null },
  sub: Parameters<typeof profileFromSubscriber>[0] & { courses?: string[] | null },
  now = new Date()
): boolean {
  if (item.deadline_at && new Date(item.deadline_at).getTime() < now.getTime() - 3600_000) return false;
  if (item.is_personal || item.source === "moodle") return true;
  const subject = squash(item.subject || "");
  if ((sub.courses || []).some((c) => c && subject.includes(squash(c)))) return true;
  return relevanceOf(item, profileFromSubscriber(sub, "focused")).relevant;
}

/** The profile a student's saved settings describe. `mode` overrides their own focus choice (phone alerts are always the strictest). */
export function profileFromSubscriber(
  sub: { categories?: unknown; keywords?: string | null; hostel?: string | null; department?: string | null; year?: string | number | null; feed_mode?: string | null },
  mode?: FeedMode
): Profile {
  return {
    categories: Array.isArray(sub.categories) ? (sub.categories as string[]) : [],
    keywords: parseKeywords(sub.keywords),
    hostel: sub.hostel,
    department: sub.department,
    year: sub.year ? String(sub.year) : null,
    mode: mode || ((sub.feed_mode as FeedMode) || "balanced"),
  };
}

export function parseKeywords(raw: string | null | undefined): string[] {
  return (raw || "").split(",").map((x) => x.trim()).filter(Boolean);
}
