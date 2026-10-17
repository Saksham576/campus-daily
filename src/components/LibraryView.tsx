"use client";

import { useMemo, useState } from "react";
import { DocHits, MyRows } from "@/components/DocSearch";

export type LibFile = {
  course_id: number;
  course_code: string | null;
  course_short: string | null;
  section: string | null;
  module: string | null;
  name: string;
  mimetype: string | null;
  view_url: string | null;
  modified_at: string | null;
};

const kindOf = (f: LibFile) => {
  const n = f.name.toLowerCase();
  if (n.endsWith(".pdf")) return "PDF";
  if (/\.(pptx?|key|odp)$/.test(n)) return "Slides";
  if (/\.(docx?|odt|txt|md)$/.test(n)) return "Doc";
  if (/\.(xlsx?|csv|ods)$/.test(n)) return "Sheet";
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return "Zip";
  if (/\.(png|jpe?g|gif|webp)$/.test(n)) return "Image";
  if (/\.(mp4|mkv|webm|mov)$/.test(n)) return "Video";
  if (/\.(c|cpp|h|py|java|ipynb|m)$/.test(n)) return "Code";
  return "File";
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "";

const codeOf = (f: LibFile) => f.course_code || f.course_short || "Other";

/** Every file from your Moodle courses: pick a course, or search across all of them. */
export function LibraryView({ files }: { files: LibFile[] }) {
  const courses = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of files) m.set(codeOf(f), (m.get(codeOf(f)) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [files]);

  const [course, setCourse] = useState<string>("recent");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle) return files.filter((f) => `${f.name} ${f.module || ""} ${f.section || ""} ${f.course_code || ""}`.toLowerCase().includes(needle));
    if (course === "recent") return files.slice(0, 30);
    return files.filter((f) => codeOf(f) === course);
  }, [files, course, q]);

  // One course: grouped by its Moodle section.
  const groups = useMemo(() => {
    if (q.trim() || course === "recent") return [{ title: "", items: shown }];
    const g = new Map<string, LibFile[]>();
    for (const f of shown) {
      const k = f.section || "General";
      g.set(k, [...(g.get(k) || []), f]);
    }
    return [...g.entries()].map(([title, items]) => ({ title, items }));
  }, [shown, course, q]);

  if (files.length === 0) {
    return <div className="empty">No course files yet. They appear here once Moodle is connected (Settings → Moodle) and the next sync runs.</div>;
  }

  const choose = (k: string) => {
    setQ("");
    setCourse(k);
  };

  return (
    <>
      <nav className="platforms" aria-label="Courses">
        <button className={`platform ${course === "recent" && !q ? "active" : ""}`} onClick={() => choose("recent")}>
          <span className="label">Recent</span>
        </button>
        {courses.map(([code, count]) => (
          <button key={code} className={`platform ${course === code && !q ? "active" : ""}`} onClick={() => choose(code)}>
            <span className="label">{code}</span>
            <span className="count">{count}</span>
          </button>
        ))}
      </nav>

      <div className="search">
        <span className="search-ico" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Search files and what’s inside them — grading, syllabus, mess dues…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search course files"
        />
      </div>
      <p className="section-note">
        {q ? `${shown.length} file${shown.length === 1 ? "" : "s"} match "${q}"` : course === "recent" ? "Newest files across your courses." : `${shown.length} files`}
        {" · "}Files open on Moodle.
      </p>

      {q.trim() ? <DocHits q={q} /> : course === "recent" ? <MyRows /> : null}

      {shown.length === 0 ? (
        q.trim() ? null : <div className="empty">Nothing here yet.</div>
      ) : (
        groups.map((g) => (
          <section key={g.title || "all"} className="lib-group">
            {g.title && <h2 className="lib-title">{g.title}</h2>}
            <ul className="lib-list">
              {g.items.map((f, i) => (
                <li key={`${f.course_id}-${f.name}-${i}`}>
                  <a href={f.view_url || "#"} target="_blank" rel="noopener noreferrer" className="lib-row">
                    <span className={`lib-kind k-${kindOf(f).toLowerCase()}`}>{kindOf(f)}</span>
                    <span className="lib-name">
                      <b>{f.name}</b>
                      <span className="from">
                        {(course === "recent" || q) && f.course_code ? `${f.course_code} · ` : ""}
                        {f.module}
                      </span>
                    </span>
                    <span className="lib-when">{when(f.modified_at)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
