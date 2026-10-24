import { notFound } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { LibraryView, type LibFile } from "@/components/LibraryView";

/** Dev-only: the Files page with real file names from a first-year course. */
export default function PreviewLibrary() {
  if (process.env.NODE_ENV === "production") notFound();
  const f = (name: string, module: string, section = "General"): LibFile => ({ course_id: 1, course_code: "CS 101", course_short: "CS 101", section, module, name, mimetype: "application/pdf", view_url: "#", modified_at: "2026-10-16T09:00:00Z" });
  const files: LibFile[] = [
    f("A26_CS101_TQ01.pdf", "Theory Quiz 1", "A26 - Quizzes and Exams"),
    f("A26_CS101_Midsem_Answers_Rubrics.pdf", "Midsem", "A26 - Quizzes and Exams"),
    f("CS101_Lab_Quiz_1_Solutions.pdf", "Lab Quiz 1", "A26 - Quizzes and Exams"),
    f("cs101-past-papers.zip", "Past CS101 Question Papers", "Past CS101 Question Papers"),
    f("Pointers.pdf", "Pointers", "Lecture Slides"),
    f("charArrays.pdf", "Chararacter Arrays and 2D Arrays", "Lecture Slides"),
    f("Lec1-2-AD.pdf", "Lec 1-2", "Lecture Slides"),
    f("CS101_2026_Tutorial_2_Solutions.docx", "Tutorial - Solutions", "Tutorials"),
    f("Tutorial_1_-_B_Solutions.pdf", "Tutorial 1 B - Solutions", "Tutorials"),
    f("lab-solutions.zip", "Lab Solutions", "Lab Solutions"),
    f("Pointers-extra.pdf", "Pointers (Extra material)", "Past CS101 Papers and Practice"),
  ];
  return (
    <>
      <AppBar />
      <main id="main" className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">From Moodle · updated every 15 min</p>
            <h1>Course files</h1>
          </div>
        </div>
        <LibraryView files={files} />
      </main>
    </>
  );
}
