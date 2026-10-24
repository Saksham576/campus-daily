"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { COURSE_CATALOG, coursesForDivision } from "@/lib/timetable/catalog";
import { cs101LabOptions, formatCourseCode, isLabSlotCode, tutorialSlotOptions } from "@/lib/timetable/slots";

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

// Courses whose lab runs in a slot of each student's own (allotted in the first lab), not by division.
const OWN_LAB = ["CS101"];
const LAB_OPTIONS = cs101LabOptions();
const TUT_OPTIONS = tutorialSlotOptions();

type Pick = Record<string, string>; // course key → division / batch / section ("" = not taking)

const isLab = (key: string) => COURSE_CATALOG[key].divisions.every((d) => /^P\d+$/.test(d.d));
// HASMED: the sectioned humanities / design / management courses, plus ENT 101 (one section).
const HASMED_EXTRA = ["ENT101"];
const isElective = (key: string) => HASMED_EXTRA.includes(key) || COURSE_CATALOG[key].divisions.every((d) => /^S\d$/.test(d.d));

/**
 * Setup step without Moodle: build the timetable from the course catalog (ResoBin data).
 * Division courses come pre-ticked; labs and HASMED electives ask for your batch / section.
 */
const level = (key: string) => (key.match(/\d/) || [""])[0]; // CL205 → "2"

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
  const [lab, setLab] = useState<Record<string, string>>({}); // course key -> lab slot code
  const [tut, setTut] = useState<Record<string, string | null>>({}); // course key -> tutorial slot ('' = none); missing = catalog default
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Start from what's saved, else the division's courses.
  useEffect(() => {
    (async () => {
      const { data } = await createClient().from("user_courses").select("course_code, division, lecture_slots, tutorial_slots");
      const p: Pick = {};
      if (data?.length) {
        const labs: Record<string, string> = {};
        const tuts: Record<string, string | null> = {};
        for (const r of data) {
          const key = r.course_code.replace(/\s+/g, "");
          p[key] = r.division || "";
          tuts[key] = (r.tutorial_slots || [])[0] || "";
          const mine = (r.lecture_slots || []).find((x: string) => isLabSlotCode(x));
          if (mine) labs[key] = mine.toUpperCase();
        }
        setLab(labs);
        setTut(tuts);
      } else for (const k of common) p[k] = division;
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
  }, [pick, dirty, lab, tut]);

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
        // A personal lab slot rides along with the lecture slots (the timetable shows it as a Lab block).
        const own = OWN_LAB.includes(k) && lab[k] ? [lab[k]] : [];
        return { user_id: user.id, course_code: k, title: c.title, division: div.d, lecture_slots: [...div.l.filter((x) => !isLabSlotCode(x)), ...own], tutorial_slots: tut[k] !== undefined ? (tut[k] ? [tut[k] as string] : []) : div.t, venue: div.v || null };
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

  const opts = (key: string) =>
    COURSE_CATALOG[key].divisions.map((d) => d.d).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Saved common courses that still belong to another division (the student changed division in Settings).
  const staleKeys = common.filter((k) => pick[k] && pick[k] !== division && COURSE_CATALOG[k]?.divisions.some((d) => d.d === division));
  const switchDivision = () => {
    setSaved(null);
    setDirty(true);
    setPick((p) => ({ ...p, ...Object.fromEntries(staleKeys.map((k) => [k, division])) }));
    // Tutorial slots follow the new division's defaults.
    setTut((t) => Object.fromEntries(Object.entries(t).filter(([k]) => !staleKeys.includes(k))));
  };

  return (
    <div className="picker">
      {staleKeys.length > 0 && (
        <div className="note" role="status">
          <span>
            Your {staleKeys.length} common course{staleKeys.length === 1 ? " is" : "s are"} still set to {pick[staleKeys[0]]}. Switch to {division}?
          </span>{" "}
          <button type="button" className="accent" onClick={switchDivision}>
            Switch to {division}
          </button>
        </div>
      )}
      {common.length > 0 ? (
        <>
          <h3>Everyone in {division} takes</h3>
          {common.map((k) => (
            <div key={k}>
              {row(k, [division])}
              {pick[k] && !OWN_LAB.includes(k) && (
                <label className="pick-lab">
                  <span>
                    Your {formatCourseCode(k)} tutorial
                    <small className="help">Your tutorial slot depends on your tutorial batch (for example T8). Leave empty if you have none.</small>
                  </span>
                  <select
                    value={tut[k] !== undefined ? tut[k] || "" : COURSE_CATALOG[k]?.divisions.find((d) => d.d === division)?.t[0] || ""}
                    onChange={(e) => {
                      setTut((t) => ({ ...t, [k]: e.target.value }));
                      setSaved(null);
                      setDirty(true);
                    }}
                    aria-label={`Tutorial slot for ${formatCourseCode(k)}`}
                  >
                    <option value="">No tutorial</option>
                    {TUT_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {OWN_LAB.includes(k) && pick[k] && (
                <label className="pick-lab">
                  <span>
                    Your {formatCourseCode(k)} lab slot
                    <small className="help">Lab times differ for everyone. Pick the slot you were allotted (it is on your first lab sheet or Moodle).</small>
                  </span>
                  <select
                    value={lab[k] || ""}
                    onChange={(e) => {
                      setLab((l) => ({ ...l, [k]: e.target.value }));
                      setSaved(null);
                      setDirty(true);
                    }}
                    aria-label={`Lab slot for ${formatCourseCode(k)}`}
                  >
                    <option value="">Not sure yet</option>
                    {LAB_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
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
          const n = q.trim().toLowerCase().replace(/\s+/g, "");
          const hits = Object.keys(COURSE_CATALOG)
            .filter((k) => !pick[k] && (k.toLowerCase().includes(n) || COURSE_CATALOG[k].title.toLowerCase().replace(/\s+/g, "").includes(n)))
            .slice(0, 12);
          return hits.length ? <div style={{ marginTop: 8 }}>{hits.map((k) => row(k, opts(k)))}</div> : <p className="help" style={{ marginTop: 8 }}>No autumn-2026 course matches. You can still add it by code below.</p>;
        })()}

      <p className="help" style={{ marginTop: 10 }} aria-live="polite">
        {busy ? "Saving…" : saved || "Changes save automatically."}
      </p>
    </div>
  );
}
