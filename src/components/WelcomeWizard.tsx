"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bell, CalendarDays, Check, MapPin, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { CoursesEditor } from "@/components/CoursesEditor";
import { CoursePicker } from "@/components/CoursePicker";
import { ResobinImport } from "@/components/ResobinImport";
import { MoodleConnect } from "@/components/MoodleConnect";
import { PushToggle } from "@/components/PushToggle";
import { DigestPicker } from "@/components/DigestPicker";
import { coursesForDivision } from "@/lib/timetable/catalog";
import { CATEGORIES, CLUBS, DEPARTMENTS, DIVISIONS, HASMED, HOSTELS, PROGRAM_YEARS, WANTS } from "@/lib/constants";

const STEPS = ["About you", "Your courses", "Interests", "Alerts"] as const;
const NOT_SURE = "?";

/** "26b2405@iitb.ac.in" -> "1" in the 2026-27 academic year (it starts in July). */
function yearFromRoll(email?: string | null): string | null {
  const m = (email || "").match(/^(\d{2})[a-z]\d/i);
  if (!m) return null;
  const now = new Date();
  const acadStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const y = acadStart - (2000 + Number(m[1])) + 1;
  return y >= 1 && y <= 5 ? String(y) : null;
}

/** First sign-in: a short guided setup. Finishing it marks the student as onboarded. */
export function WelcomeWizard({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imported, setImported] = useState(0); // remount the picker after a ResoBin import
  const [name, setName] = useState("");
  const [form, setForm] = useState({
    department: "",
    year: "1",
    division: "",
    hostel: "",
    hasmed: HASMED[0] as string,
    categories: [...CATEGORIES] as string[],
    keywords: "",
  });

  useEffect(() => {
    if (demo) return;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");
      const { data: sub } = await supabase.from("subscribers").select("*").eq("email", (user.email || "").toLowerCase()).maybeSingle();
      if (sub?.onboarded_at) return router.replace("/");
      setName(String(sub?.name || "").split(" ")[0]);
      if (sub) {
        setForm((f) => ({
          ...f,
          department: sub.department || "",
          year: sub.year ? String(sub.year) : yearFromRoll(user.email) || f.year,
          division: sub.division || "",
          hostel: sub.hostel || "",
          categories: Array.isArray(sub.categories) && sub.categories.length ? sub.categories : f.categories,
          keywords: sub.keywords || "",
        }));
      } else {
        const y = yearFromRoll(user.email);
        if (y) setForm((f) => ({ ...f, year: y }));
      }
      setReady(true);
    })();
  }, [router, demo]);

  // Clubs and "also tell me about" chips live in the keywords box, so they stay editable.
  const kwList = form.keywords.split(",").map((x) => x.trim()).filter(Boolean);
  const hasKw = (kw: string) => kwList.some((x) => x.toLowerCase() === kw.toLowerCase());
  const toggleKw = (kw: string) =>
    setForm((f) => {
      const list = f.keywords.split(",").map((x) => x.trim()).filter(Boolean);
      const on = list.some((x) => x.toLowerCase() === kw.toLowerCase());
      return { ...f, keywords: (on ? list.filter((x) => x.toLowerCase() !== kw.toLowerCase()) : [...list, kw]).join(", ") };
    });

  const toggle = (c: string) =>
    setForm((f) => ({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] }));

  async function save(finish: boolean) {
    if (demo) return;
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return router.replace("/login");
      const keywords = form.keywords.trim() || null;
      const payload: Record<string, unknown> = {
        email: user.email.toLowerCase(),
        user_id: user.id,
        department: form.department,
        year: form.year,
        division: form.year === "1" && form.division !== NOT_SURE ? form.division : null,
        hostel: form.hostel,
        hasmed: form.year === "1" ? form.hasmed : null,
        hasmed1: form.year === "1" ? form.hasmed : null,
        categories: form.categories,
        category: form.categories.join(", "),
        keywords,
        interests: keywords,
        updated_at: new Date().toISOString(),
      };
      if (finish) payload.onboarded_at = new Date().toISOString();
      const { error: e } = await supabase.from("subscribers").upsert(payload, { onConflict: "email" });
      if (e) throw new Error(e.message);
      if (finish) {
        // Show everything straight away: the division common courses (if none yet) and recent notices.
        const { count } = await supabase.from("user_courses").select("course_code", { count: "exact", head: true });
        if (!count && form.year === "1") {
          const rows = coursesForDivision(division).map((c) => ({ ...c, user_id: user.id }));
          if (rows.length) await supabase.from("user_courses").upsert(rows, { onConflict: "user_id,course_code", ignoreDuplicates: true });
        }
        await supabase.rpc("backfill_my_feed");
        router.refresh();
        router.replace("/");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const division = form.division === NOT_SURE ? "" : form.division;
  const aboutOk = !!form.department && !!form.hostel && (form.year !== "1" || !!form.division);

  async function next() {
    await save(false); // keep progress as you go
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  if (!ready) {
    return (
      <main className="wrap welcome">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="wrap welcome">
      <div className="welcome-top">
        <Logo />
        <span className="muted small">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>
      <div className="welcome-bar" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={i <= step ? "on" : ""} />
        ))}
      </div>

      {step === 0 && (
        <section className="welcome-card">
          <h1>{name ? `Welcome, ${name}` : "Welcome to Campus Daily"}</h1>
          <p className="muted">Two minutes to set up. Here is what you get:</p>
          <ul className="perks">
            <li>
              <Bell aria-hidden />
              <span>
                <b>Never walk to a cancelled class</b>
                <small>Cancelled, moved or shifted classes reach you the moment they are announced.</small>
              </span>
            </li>
            <li>
              <MapPin aria-hidden />
              <span>
                <b>Your exam room and seat, found for you</b>
                <small>We read the seating PDFs so you only see your own row: room, seat, time.</small>
              </span>
            </li>
            <li>
              <CalendarDays aria-hidden />
              <span>
                <b>A timetable that updates itself</b>
                <small>A month ahead, with holidays, buffer weeks, quizzes and room changes added from notices.</small>
              </span>
            </li>
            <li>
              <Sparkles aria-hidden />
              <span>
                <b>Only what matters to you</b>
                <small>Events, orientations, deadlines and club posts, ranked by your department, hostel and interests.</small>
              </span>
            </li>
          </ul>
          <div className="pform" style={{ marginTop: 18 }}>
            <div className="row2">
              <label className="field">
                Department
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Year
                <select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                  {PROGRAM_YEARS.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row2">
              <label className="field">
                Hostel
                <select value={form.hostel} onChange={(e) => setForm({ ...form, hostel: e.target.value })}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {HOSTELS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
              {form.year === "1" && (
                <label className="field">
                  Division
                  <select value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })}>
                    <option value="" disabled>
                      Choose…
                    </option>
                    {DIVISIONS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                    <option value={NOT_SURE}>Not sure yet</option>
                  </select>
                </label>
              )}
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="welcome-card">
          <h1>Your courses</h1>
          <p className="muted">Tick what you take this semester. This builds your timetable. You can change it anytime in Settings.</p>
          <div className="welcome-block">
            <CoursePicker key={imported} division={division} department={form.department} year={form.year} />
            <details className="more-courses">
              <summary>A course isn&apos;t listed? Add it by code</summary>
              <CoursesEditor />
            </details>
          </div>
          <details className="welcome-block welcome-more">
            <summary>
              <b>On a laptop? Connect Moodle for an exact timetable</b>
              <span className="help">Also brings slides and deadlines. Takes a minute, once. You can also do this later from Settings.</span>
            </summary>
            <MoodleConnect />
            <div style={{ marginTop: 14 }}>
              <ResobinImport onDone={() => setImported((x) => x + 1)} />
            </div>
          </details>
        </section>
      )}

      {step === 2 && (
        <section className="welcome-card">
          <h1>What do you care about?</h1>
          <p className="muted">Notices on ticked topics rank higher. All are on to start: tap the ones you don&apos;t care about to turn them off.</p>
          <div className="chips" style={{ marginTop: 16 }}>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`chip ${form.categories.includes(c) ? "on" : ""}`} aria-pressed={form.categories.includes(c)} onClick={() => toggle(c)}>
                {form.categories.includes(c) && <Check aria-hidden className="chip-tick" />}
                {c}
              </button>
            ))}
          </div>
          <h2 className="chips-title">Clubs you follow</h2>
          <div className="chips">
            {CLUBS.map((c) => (
              <button key={c} type="button" className={`chip ${hasKw(c) ? "on" : ""}`} aria-pressed={hasKw(c)} onClick={() => toggleKw(c)}>
                {hasKw(c) && <Check aria-hidden className="chip-tick" />}
                {c}
              </button>
            ))}
          </div>
          <h2 className="chips-title">Also tell me about</h2>
          <div className="chips">
            {WANTS.map((w) => (
              <button key={w.kw} type="button" className={`chip ${hasKw(w.kw) ? "on" : ""}`} aria-pressed={hasKw(w.kw)} onClick={() => toggleKw(w.kw)} title={w.hint}>
                {hasKw(w.kw) && <Check aria-hidden className="chip-tick" />}
                {w.label}
              </button>
            ))}
          </div>
          <label className="field" style={{ marginTop: 18 }}>
            Keywords (optional)
            <input type="text" placeholder="robotics, football, placement…" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            <span className="help">Comma-separated: clubs, sports, anything.</span>
          </label>
        </section>
      )}

      {step === 3 && (
        <section className="welcome-card">
          <h1>Never walk to a cancelled class</h1>
          <p className="muted">Turn on notifications and we&apos;ll tell you the moment a class is cancelled or moved. It looks like this:</p>
          <div className="notif-demo" aria-hidden>
            <Logo />
            <div>
              <b>CH 111 cancelled today</b>
              <span>The 9:30 lecture in LA 201 won&apos;t happen.</span>
            </div>
            <time>now</time>
          </div>
          <PushToggle />
          <div className="welcome-block">
            <h2>Also: a morning summary at 7:30</h2>
            <DigestPicker />
          </div>
        </section>
      )}

      {error && <p className="err">{error}</p>}

      {step === 0 && !aboutOk && <p className="help welcome-hint">Pick your department, hostel{form.year === "1" ? " and division" : ""} to continue.</p>}

      <div className="welcome-nav">
        {step > 0 ? (
          <button type="button" className="ghost" onClick={() => setStep(step - 1)} disabled={saving}>
            <ArrowLeft aria-hidden />
            Back
          </button>
        ) : (
          <span />
        )}
        <span className="welcome-nav-r">
          {step === 1 && (
            <button type="button" className="link" onClick={next} disabled={saving}>
              Skip for now
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="primary" onClick={next} disabled={saving || (step === 0 && !aboutOk)}>
              Continue
              <ArrowRight aria-hidden />
            </button>
          ) : (
            <button type="button" className="primary" onClick={() => save(true)} disabled={saving}>
              <Check aria-hidden />
              {saving ? "Finishing…" : "Go to Campus Daily"}
            </button>
          )}
        </span>
      </div>
    </main>
  );
}
