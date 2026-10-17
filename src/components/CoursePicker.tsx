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
const isElective = (key: string) => COURSE_CATALOG[key].divisions.every((d) => /^S\d$/.test(d.d));

/**
 * Setup step without Moodle: build the timetable from the course catalog (ResoBin data).
 * Division courses come pre-ticked; labs and HASMED electives ask for your batch / section.
 */
export function CoursePicker({ division, department, onSaved }: { division: string; department?: string | null; onSaved?: (n: number) => void }) {
  const [showAll, setShowAll] = useState(false);
  const prefixes = DEPT_PREFIX.find(([re]) => re.test(department || ""))?.[1] || [];
  const common = useMemo(() => coursesForDivision(division).map((c) => c.course_code), [division]);
  const labs = useMemo(() => Object.keys(COURSE_CATALOG).filter(isLab), []);
  const electives = useMemo(() => Object.keys(COURSE_CATALOG).filter(isElective), []);
  const others = useMemo(
    () => Object.keys(COURSE_CATALOG).filter((k) => !common.includes(k) && !isLab(k) && !isElective(k)),
    [common]
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

      <h3>Your lab batches</h3>
      <p className="help">Your batch is on your lab schedule or Moodle (e.g. P16). Leave unticked if you don&apos;t have that lab this semester.</p>
      {labs.map((k) => row(k, opts(k), "Batch"))}

      <h3>HASMED / design electives</h3>
      {electives.map((k) => row(k, opts(k), "Section"))}

      <h3>Department and other courses</h3>
      {others.filter((k) => prefixes.some((x) => k.startsWith(x)) || pick[k]).map((k) => row(k, opts(k)))}
      {!showAll ? (
        <button type="button" className="link" onClick={() => setShowAll(true)}>
          Show courses from other departments
        </button>
      ) : (
        others.filter((k) => !prefixes.some((x) => k.startsWith(x)) && !pick[k]).map((k) => row(k, opts(k)))
      )}

      <p className="help" style={{ marginTop: 10 }} aria-live="polite">
        {busy ? "Saving…" : saved || "Changes save automatically."}
      </p>
    </div>
  );
}
