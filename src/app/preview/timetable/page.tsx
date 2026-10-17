"use client";

import { AppBar } from "@/components/AppBar";
import { TimetableView, type Slot } from "@/components/TimetableView";
import { buildWeek, type UserCourse } from "@/lib/timetable/slots";
import { Download, Plus } from "lucide-react";

/** Dev-only: the Timetable with real IITB slot times for sample courses. */
export default function PreviewTimetable() {
  if (process.env.NODE_ENV === "production") return null;
  const courses = [
    { course_code: "MA105", title: "Calculus", division: "D3", lecture_slots: ["1A","1B","1C"], tutorial_slots: ["X1"], venue: "LA 201" },
    { course_code: "CH111", title: "Chemistry", division: "D3", lecture_slots: ["2A","2B","2C"], tutorial_slots: [], venue: "LA 201" },
    { course_code: "CS101", title: "Computer Programming", division: "D3", lecture_slots: ["4A","4B"], tutorial_slots: [], venue: "LA 001" },
    { course_code: "PH117", title: "Physics Lab", division: "P16", lecture_slots: ["L2"], tutorial_slots: [], venue: "Physics Lab 2" },
    { course_code: "ENT101", title: "Innovation & Entrepreneurship", division: "Core", lecture_slots: ["14A"], tutorial_slots: [], venue: "LH 101" },
  ] as unknown as UserCourse[];
  const ref = new Date();
  if (ref.getDay() === 6 || ref.getDay() === 0) ref.setDate(ref.getDate() + (ref.getDay() === 6 ? 2 : 1));
  const slots = buildWeek(courses, ref).map((s, i) => ({ ...s, is_cancelled: i === 3 })) as Slot[];
  return (
    <>
      <AppBar />
      <main className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">This week · updates itself from notices</p>
            <h1>Timetable</h1>
          </div>
          <div className="nav-links">
            <button type="button">
              <Plus aria-hidden />
              Add slot
            </button>
            <button type="button">
              <Download aria-hidden />
              Export
            </button>
          </div>
        </div>
        <TimetableView slots={slots} onToggle={() => {}} />
      </main>
    </>
  );
}
