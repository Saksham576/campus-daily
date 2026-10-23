export const DEPARTMENTS = [
  "Aerospace Engineering",
  "Biosciences & Bioengineering (BSBE)",
  "Chemical Engineering",
  "Chemistry",
  "Civil Engineering",
  "Computer Science & Engineering",
  "Earth Sciences",
  "Economics",
  "Electrical Engineering",
  "Energy Science & Engineering",
  "Environmental Science & Engineering (ESED)",
  "Humanities & Social Sciences",
  "Industrial Engineering & Operations Research (IEOR)",
  "Mathematics",
  "Mechanical Engineering",
  "Metallurgical Engineering & Materials Science (MEMS)",
  "Physics",
  "Design (IDC)",
  "Management (SJMSOM)",
];

export const PROGRAM_YEARS = ["1", "2", "3", "4", "5"];

export const DIVISIONS = ["D1", "D2", "D3", "D4"];

export const HASMED = [
  "Entrepreneurship",
  "Sociology",
  "Philosophy",
  "Psychology",
  "Literature",
  "Ecology",
  "Management",
  "NCC/NSO/NSS",
];

export const HOSTELS = [
  ...Array.from({ length: 21 }, (_, i) => `Hostel ${i + 1}`),
  "Tansa",
  "Off-Campus",
];

export const CATEGORIES = [
  "Academics",
  "Placements / Internships",
  "Competitions / Hackathons",
  "Fests & Cultural",
  "Sports",
  "Talks & Seminars",
  "Hostel / Campus Life",
];

/** Clubs and groups a student can follow at setup; picked ones become keywords that lift matching notices. */
export const CLUBS = [
  "Techfest",
  "Mood Indigo",
  "E-Cell",
  "Insight",
  "Web & Coding Club",
  "Robotics",
  "Aeromodelling",
  "Music",
  "Dramatics",
  "Photography",
  "Quizzing",
  "Debating",
  "Finance club",
  "NSS",
];

/** Kinds of things worth hearing about, each mapped to the keyword that finds them. */
export const WANTS: { label: string; kw: string; hint: string }[] = [
  { label: "Orientation & freshie events", kw: "orientation", hint: "Welcome sessions, club orientations, freshie nights" },
  { label: "Hackathons & coding contests", kw: "hackathon", hint: "Cash prizes, team formation, registrations" },
  { label: "Sports trials & NSO", kw: "trials", hint: "Selections, pre-camps, inter-hostel matches" },
  { label: "Internship & placement talks", kw: "internship", hint: "Company talks, resume workshops, deadlines" },
  { label: "Scholarships & fee notices", kw: "scholarship", hint: "Fee waivers, deadlines, forms" },
  { label: "Mess & hostel updates", kw: "mess", hint: "Menus, shutdowns, maintenance, allotments" },
];

export type DeliveryPreference = "app" | "email" | "both";

/**
 * Maps any legacy category string or broken token to modern canonical CATEGORIES.
 */
export function normalizeCategory(token: string): string | null {
  const t = token.trim().toLowerCase();
  if (!t || t === "etc.)" || t === "etc" || t === "sessions") return null;

  if (
    t.includes("acad") ||
    t.includes("course") ||
    t.includes("excel") ||
    t.includes("exam") ||
    t.includes("deadline") ||
    t.includes("scholarship") ||
    t.includes("fellowship") ||
    t.includes("fee") ||
    t.includes("research")
  ) {
    return "Academics";
  }
  if (t.includes("placement") || t.includes("intern")) {
    return "Placements / Internships";
  }
  if (
    t.includes("hackathon") ||
    t.includes("compet") ||
    t.includes("startup") ||
    t.includes("entrepreneur")
  ) {
    return "Competitions / Hackathons";
  }
  if (
    t.includes("fest") ||
    t.includes("cultur") ||
    t.includes("club") ||
    t.includes("society")
  ) {
    return "Fests & Cultural";
  }
  if (t.includes("sport") || t.includes("gymkhana")) {
    return "Sports";
  }
  if (
    t.includes("talk") ||
    t.includes("seminar") ||
    t.includes("workshop") ||
    t.includes("lecture")
  ) {
    return "Talks & Seminars";
  }
  if (
    t.includes("hostel") ||
    t.includes("mess") ||
    t.includes("campus life") ||
    t.includes("admin") ||
    t.includes("institute-wide")
  ) {
    return "Hostel / Campus Life";
  }
  return null;
}

/**
 * Normalizes an array or comma-separated string of categories into a deduplicated
 * array of canonical CATEGORIES. Falls back to all CATEGORIES if none match or empty.
 */
export function normalizeCategories(raw: string[] | string | null | undefined): string[] {
  if (!raw) return [...CATEGORIES];
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
    ? raw.split(",")
    : [];

  const matched = new Set<string>();
  for (const item of items) {
    const norm = normalizeCategory(item);
    if (norm && CATEGORIES.includes(norm)) {
      matched.add(norm);
    }
  }

  return matched.size > 0 ? Array.from(matched) : [...CATEGORIES];
}

/**
 * Normalizes delivery preference, mapping between modern and legacy formats.
 */
export function normalizeDeliveryPreference(
  deliveryPref: string | null | undefined,
  legacyDelivery: string | null | undefined
): DeliveryPreference {
  if (deliveryPref === "app" || deliveryPref === "email" || deliveryPref === "both") {
    return deliveryPref;
  }
  if (legacyDelivery === "app_email") {
    return "both";
  }
  if (legacyDelivery === "app" || legacyDelivery === "email") {
    return legacyDelivery;
  }
  return "app";
}

export type Profile = {
  department: string;
  year: string;
  division?: string;
  hostel: string;
  hasmed?: string;
  categories: string[];
  keywords?: string;
  personal_email?: string;
  delivery_preference: DeliveryPreference;
  moodle_ical_url?: string;
};

