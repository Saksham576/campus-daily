export const DEPARTMENTS = [
  "Aerospace Engineering",
  "Chemical Engineering",
  "Chemistry",
  "Civil Engineering",
  "Computer Science & Engineering",
  "Electrical Engineering",
  "Energy Science & Engineering",
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

export type DeliveryPreference = "app" | "email" | "both";

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
