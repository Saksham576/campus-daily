import { notFound } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { DayBoard, type BoardRow } from "@/components/DayBoard";
import { FeedView } from "@/components/FeedView";
import { HomeHead } from "@/components/HomeHead";
import { AskBox } from "@/components/AskBox";
import { buildSections } from "@/lib/sections";

/** Dev-only: the Home screen with realistic sample data, for design work without signing in. */
export default function Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  const now = new Date();
  const at = (h: number, m = 0, dayOffset = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    const ist = new Date(`${d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
    return ist.toISOString();
  };
  const late = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })) >= 19;
  const d = late ? 1 : 0;
  const rows: BoardRow[] = [
    { id: "1", start: at(8, 30, d), end: at(9, 25, d), code: "MA 105", name: "Calculus", venue: "LA 201" },
    { id: "2", start: at(9, 30, d), end: at(10, 25, d), code: "CH 111", name: "Chemistry", venue: "LA 201", cancelled: true },
    { id: "3", start: at(11, 5, d), end: at(12, 30, d), code: "CS 101", name: "Computer Programming", venue: "LA 001" },
    { id: "4", start: at(14, 0, d), end: at(15, 25, d), code: "PH 117", name: "Physics Lab", venue: "Physics Lab 2", moved: true },
    { id: "5", start: at(17, 15, d), end: at(18, 15, d), code: "ENT 101", name: "Innovation & Entrepreneurship", venue: "LH 101" },
  ];
  const base = { score: 7, status: "new" as const, tags: ["Academics"], received_at: at(9, 0, -1) };
  const items = [
    { ...base, id: "a1", subject: "[Student-notices] Tuition Fee Support Scholarships | Deadline extended up to 30th October", from_address: "dean.acr.office@iitb.ac.in", summary: "UG students with family income up to ₹25 lakh can apply on the ASC portal. Deadline now 30 October.", deadline_at: at(23, 59, 14) },
    { ...base, id: "a2", subject: "[S.Events] Mock Interviews & Group Discussions | Alumination 2026", from_address: "dean.sa.office@iitb.ac.in", summary: "Register for mock interviews and GDs with alumni. Registration closes 24 October.", deadline_at: at(23, 59, 1), score: 8 },
    { ...base, id: "e1", subject: "MA 105-2026-1-ALL: Quiz 2 syllabus", from_address: "Saikat Mazumdar (via Moodle)", source: "moodle", summary: "Quiz 2 on Friday 23 October: double/triple integrals, Fubini, Jacobians, vector fields, line integrals.", body: "The syllabus for the second quiz for MA 105, to be held on Friday, 23rd October 2026 at 5:15 PM in LA 201, is as follows: Double and triple integration…", seat: "LA 201 · B14" },
    { ...base, id: "c1", subject: "[Bodhitree] [Forum - CS101A26] 20th Oct Lab shifted to Sun, 25th Oct from 8:15 am to 10:15 am", from_address: "Bodhitree <noreply@robin.bodhi.cse.iitb.ac.in>", summary: "The 20 Oct CS 101 lab moves to Sunday 25 Oct, 8:15–10:15 AM. Ignore earlier messages.", received_at: at(16, 0, -1) },
    { ...base, id: "c2", subject: "CH 111-2026-1-D3: New file — CH111 Physical Slides", from_address: "Moodle", source: "moodle", summary: "Lecture 8–9: hydrogen atom wavefunctions (slides).", received_at: at(9, 15, -2), links: ["https://moodle.iitb.ac.in/course/view.php?id=391"] },
    { ...base, id: "v1", subject: "[S.Events] Aavhan Orientation x Redbull Wings Cup | 16th October | 5:45 pm | P.C. Saxena Auditorium", from_address: "gsecsport@iitb.ac.in", tags: ["Sports"], summary: "Aavhan orientation with Redbull Wings Cup reveal — meet the team behind IITB's biggest sports fest.", body: "Join us on 18th October 2026 at 5:45 PM in P.C. Saxena Auditorium" },
    { ...base, id: "o1", subject: "[S.Events] Inter IIT Tech 15.0 | AI-ML High-prep Problem Statement by Sarvam AI Now Open!", from_address: "gsectech@iitb.ac.in", tags: ["Competitions / Hackathons"], summary: "Second high-prep problem statement is out. Form a team and submit your proposal." },
    { ...base, id: "w1", subject: "[WhatsApp · Hostel 16] Water supply in Wing A will be off from 2–4 PM tomorrow for tank cleaning", from_address: "WhatsApp: Hostel 16", source: "whatsapp", tags: ["Hostel / Campus Life"], summary: "Wing A water off 2–4 PM tomorrow (tank cleaning)." },
  ];
  const sections = buildSections(items as any, new Set(["MA 105", "CH 111", "CS 101", "PH 117", "ENT 101"]), now);
  return (
    <>
      <AppBar />
      <main className="wrap">
        <HomeHead name={"Saksham Tiwari"} now={now} action={sections.action} exams={sections.exams} />
        <DayBoard title={late ? "Tomorrow" : "Today"} rows={rows} emptyText="No classes scheduled." />
        <AskBox />
        <FeedView sections={sections as any} sponsored={null} />
      </main>
    </>
  );
}
