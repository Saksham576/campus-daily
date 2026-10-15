"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { COURSE_CATALOG, catalogKey } from "@/lib/timetable/catalog";
import { slotTime, formatCourseCode, type UserCourse } from "@/lib/timetable/slots";

const parseSlots = (s: string) =>
  s
    .toUpperCase()
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Settings → My courses: the timetable is built from these. */
export function CoursesEditor() {
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [code, setCode] = useState("");
  const [division, setDivision] = useState("");
  const [lecture, setLecture] = useState("");
  const [tutorial, setTutorial] = useState("");
  const [venue, setVenue] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const key = catalogKey(code);
  const known = COURSE_CATALOG[key];

  async function load() {
    const { data } = await createClient()
      .from("user_courses")
      .select("course_code, title, division, lecture_slots, tutorial_slots, venue")
      .order("course_code");
    setCourses((data || []) as UserCourse[]);
  }
  useEffect(() => {
    load();
  }, []);

  // Picking a division of a known course fills in its slots and venue.
  useEffect(() => {
    const d = known?.divisions.find((x) => x.d === division);
    if (d) {
      setLecture(d.l.join(" "));
      setTutorial(d.t.join(" "));
      setVenue(d.v);
    }
  }, [division, known]);

  async function add() {
    setMsg(null);
    if (!/^[A-Z]{2,3}\d{3}[A-Z]?$/.test(key)) return setMsg({ ok: false, text: "Enter a course code like MA105." });
    const lec = parseSlots(lecture);
    const tut = parseSlots(tutorial);
    const bad = [...lec, ...tut].filter((s) => !slotTime(s));
    if (bad.length) return setMsg({ ok: false, text: `Unknown slot(s): ${bad.join(", ")}. Use codes like 2A, 7B, X1, L4.` });
    if (lec.length + tut.length === 0) return setMsg({ ok: false, text: "Pick your division, or type the course's slots." });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("user_courses").upsert({
      user_id: user.id,
      course_code: key,
      title: known?.title || null,
      division: division || null,
      lecture_slots: lec,
      tutorial_slots: tut,
      venue: venue.trim() || null,
    });
    if (error) return setMsg({ ok: false, text: "Could not save. Try again." });
    setCode("");
    setDivision("");
    setLecture("");
    setTutorial("");
    setVenue("");
    setMsg({ ok: true, text: `${formatCourseCode(key)} added to your timetable.` });
    load();
  }

  async function remove(c: string) {
    await createClient().from("user_courses").delete().eq("course_code", c);
    load();
  }

  return (
    <div id="courses">
      {courses.length === 0 && <p className="muted small">No courses yet. Add each course you are registered for.</p>}
      {courses.map((c) => (
        <div key={c.course_code} className="row2" style={{ alignItems: "center", marginBottom: 6 }}>
          <span>
            <b>{formatCourseCode(c.course_code)}</b> {c.title || ""}{" "}
            <span className="muted small">
              {c.division ? `${c.division} · ` : ""}
              {[...c.lecture_slots, ...c.tutorial_slots.map((t) => `${t} (tut)`)].join(" ")}
              {c.venue ? ` · ${c.venue}` : ""}
            </span>
          </span>
          <button type="button" className="link" onClick={() => remove(c.course_code)}>
            Remove
          </button>
        </div>
      ))}

      <div style={{ marginTop: 12 }}>
        <div className="row2">
          <label>
            Course code
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MA105" />
          </label>
          {known ? (
            <label>
              Division / batch
              <select value={division} onChange={(e) => setDivision(e.target.value)}>
                <option value="">Choose…</option>
                {known.divisions.map((d) => (
                  <option key={d.d} value={d.d}>
                    {d.d} — {[...d.l, ...d.t].join(" ")}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Lecture slots
              <input value={lecture} onChange={(e) => setLecture(e.target.value)} placeholder="2A 2B 2C" />
            </label>
          )}
        </div>
        {!known && key.length >= 5 && (
          <div className="row2">
            <label>
              Tutorial / lab slots (optional)
              <input value={tutorial} onChange={(e) => setTutorial(e.target.value)} placeholder="X1 or L4" />
            </label>
            <label>
              Venue (optional)
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="LT 204" />
            </label>
          </div>
        )}
        {known && <p className="muted small">{known.title} — slots from ResoBin (autumn 2026).</p>}
        {!known && key.length >= 5 && (
          <p className="muted small">Find this course&apos;s slots on ResoBin or ASC and type them here.</p>
        )}
        <button type="button" className="primary" onClick={add} style={{ marginTop: 8 }}>
          Add course
        </button>
        {msg && <p className={msg.ok ? "note" : "err"}>{msg.text}</p>}
      </div>
    </div>
  );
}
