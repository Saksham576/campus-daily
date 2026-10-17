"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { COURSE_CATALOG, coursesForDivision } from "@/lib/timetable/catalog";
import { formatCourseCode } from "@/lib/timetable/slots";

// Department name → course-code prefixes (IITB)
const DEPT_PREFIX: [RegExp, string[]][] = [
  [/aerospace/i, ["AE"]],
  [/chemical/i, ["CL"]],
  [/^chemistry/i, ["CH"]],
  [/civil/i, ["CE"]],
  [/computer/i, ["CS"]],
  [/electrical/i, ["EE"]],
  [/energy/i, ["EN"]],
  [/environment/i, ["ES"]],
  [/mechanical/i, ["ME"]],
  [/metallurg|mems/i, ["MM"]],
  [/mathematic/i, ["MA"]],
  [/physics/i, ["PH"]],
  [/economic|humanit/i, ["HS"]],
];

type Pick = Record<string, string>; // course key → division / batch / section ("" = not taking)

const isLab = (key: string) => COURSE_CATALOG[key].divisions.every((d) => /^P\d+$/.test(d.d));
// HASMED: the sectioned humanities / design / management courses, plus ENT 101 (one section).
const HASMED_EXTRA = ["ENT101"];
const isElective = (key: string) => HASMED_EXTRA.includes(key) || COURSE_CATALOG[key].divisions.every((d) => /^S\d$/.test(d.d));

/**
 * Setup step without Moodle: build the timetable from the course catalog (ResoBin data).
 * Division courses come pre-ticked; labs and HASMED electives ask for your batch / section.
 */
const level = (key: string) => (key.match(/d/) || [""])[0]; // CL205 → "2"

export function CoursePicker({
  division,
  department,
  year,
  onSaved,
}: {
  division: string;
  department?: string | null;
  year?: string | null;
  onSaved?: (n: number) => void;
}) {
  const [q, setQ] = useState("");
  const firstYear = !year || String(year) === "1";
  const prefixes = DEPT_PREFIX.find(([re]) => re.test(department || ""))?.[1] || [];
  const common = useMemo(() => coursesForDivision(division).map((c) => c.course_code), [division]);
  // First-year labs / Makerspace and HASMED (100-level courses only).
  const labs = useMemo(() => Object.keys(COURSE_CATALOG).filter((k) => level(k) === "1" && isLab(k)), []);
  const electives = useMemo(() => Object.keys(COURSE_CATALOG).filter((k) => level(k) === "1" && isElective(k)), []);
  // Your department's courses at your year's level (CL2xx for a 2nd-year Chemical student).
  const deptCourses = useMemo(
    () =>
      Object.keys(COURSE_CATALOG).filter(
        (k) => prefixes.some((x) => k.startsWith(x)) && level(k) === String(year || "1") && !common.includes(k) && !labs.includes(k) && !electives.includes(k)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [department, year, common]
  );

  const [pick, setPick] = useState<Pick>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Start from what's saved, else the division's courses.
  useEffect(() => {
    (async () => {
      const { data } = await createClient().from("user_courses").select("course_code, division");
      const p: Pick = {};
      if (data?.length) for (const r of data) p[r.course_code.replace(/\s+/g, "")] = r.division || "";
      else for (const k of common) p[k] = division;
      setPick(p);
    })();
  }, [common, division]);

  const set = (key: string, value: string) => {
    setSaved(null);
    setDirty(true);
    setPick((p) => ({ ...p, [key]: value }));
  };

  // Save as you tick, so nothing is lost if you just press Continue.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, dirty]);

  async function save() {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setBusy(false);
    const rows = Object.entries(pick)
      .filter(([k, d]) => d && COURSE_CATALOG[k])
      .map(([k, d]) => {
        const c = COURSE_CATALOG[k];
        const div = c.divisions.find((x) => x.d === d) || c.divisions[0];
        return { user_id: user.id, course_code: k, title: c.title, division: div.d, lecture_slots: div.l, tutorial_slots: div.t, venue: div.v || null };
      });
    const drop = Object.entries(pick)
      .filter(([k, d]) => !d && COURSE_CATALOG[k])
      .map(([k]) => k);
    if (drop.length) await supabase.from("user_courses").delete().in("course_code", drop);
    if (rows.length) await supabase.from("user_courses").upsert(rows, { onConflict: "user_id,course_code" });
    setBusy(false);
    setSaved(`Saved ${rows.length} course${rows.length === 1 ? "" : "s"}.`);
    onSaved?.(rows.length);
  }

  const row = (key: string, options: string[], label?: string) => {
    const c = COURSE_CATALOG[key];
    const on = !!pick[key];
    return (
      <div key={key} className={`pick-row ${on ? "on" : ""}`}>
        <label className="pick-main">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => set(key, e.target.checked ? (options.length === 1 ? options[0] : pick[key] || options[0]) : "")}
          />
          <span>
            <b>{formatCourseCode(key)}</b> {c.title}
          </span>
        </label>
        {options.length > 1 && (
          <select value={pick[key] || ""} onChange={(e) => set(key, e.target.value)} aria-label={`${label || "Division"} for ${formatCourseCode(key)}`}>
            <option value="">{label ? `${label}…` : "Not taking"}</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  };

  const opts = (key: string) => COURSE_CATALOG[key].divisions.map((d) => d.d);

  return (
    <div className="picker">
      {common.length > 0 ? (
        <>
          <h3>Everyone in {division} takes</h3>
          {common.map((k) => row(k, [division]))}
        </>
      ) : (
        <p className="note" style={{ marginTop: 0 }}>
          We don&apos;t have a ready list for {division || "your division"} yet — tick your courses below.
        </p>
      )}

      {firstYear && (
        <>
          <h3>Labs and Makerspace</h3>
          <p className="help">These run by batch. Your batch is on your lab schedule or Moodle (e.g. P16). Leave unticked if you don&apos;t have it this semester.</p>
          {labs.map((k) => row(k, opts(k), "Batch"))}

          <h3>Your HASMED</h3>
          <p className="help">Tick the one you were allotted and pick its section (S1 or S2).</p>
          {electives.map((k) => row(k, opts(k), "Section"))}
        </>
      )}

      {deptCourses.length > 0 && (
        <>
          <h3>Your department{year ? ` (${year}00-level)` : ""}</h3>
          {deptCourses.map((k) => row(k, opts(k)))}
        </>
      )}

      {/* Anything you've picked that isn't in a list above */}
      {Object.keys(pick)
        .filter((k) => pick[k] && COURSE_CATALOG[k] && !common.includes(k) && !labs.includes(k) && !electives.includes(k) && !deptCourses.includes(k))
        .map((k) => row(k, opts(k)))}

      <h3>Find any course</h3>
      <input type="search" placeholder="Search by code or name — e.g. CL205, Thermodynamics" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search courses" />
      {q.trim().length >= 2 &&
        (() => {
          const n = q.trim().toLowerCase().replace(/s+/g, "");
          const hits = Object.keys(COURSE_CATALOG)
            .filter((k) => !pick[k] && (k.toLowerCase().includes(n) || COURSE_CATALOG[k].title.toLowerCase().replace(/s+/g, "").includes(n)))
            .slice(0, 12);
          return hits.length ? <div style={{ marginTop: 8 }}>{hits.map((k) => row(k, opts(k)))}</div> : <p className="help" style={{ marginTop: 8 }}>No autumn-2026 course matches. You can still add it by code below.</p>;
        })()}

      <p className="help" style={{ marginTop: 10 }} aria-live="polite">
        {busy ? "Saving…" : saved || "Changes save automatically."}
      </p>
    </div>
  );
}
