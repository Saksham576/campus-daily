"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { CoursesEditor } from "@/components/CoursesEditor";
import { MoodleConnect } from "@/components/MoodleConnect";
import { PushToggle } from "@/components/PushToggle";
import { DigestPicker } from "@/components/DigestPicker";
import { CATEGORIES, DEPARTMENTS, DIVISIONS, HASMED, HOSTELS, PROGRAM_YEARS } from "@/lib/constants";

const STEPS = ["About you", "Your courses", "Interests", "Alerts"] as const;

/** First sign-in: a short guided setup. Finishing it marks the student as onboarded. */
export function WelcomeWizard({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
          year: sub.year ? String(sub.year) : f.year,
          division: sub.division || "",
          hostel: sub.hostel || "",
          categories: Array.isArray(sub.categories) && sub.categories.length ? sub.categories : f.categories,
          keywords: sub.keywords || "",
        }));
      }
      setReady(true);
    })();
  }, [router, demo]);

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
        division: form.year === "1" ? form.division : null,
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
        router.refresh();
        router.replace("/");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

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
          <p className="muted">Two minutes to set up. This is how we pick notices meant for you.</p>
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
          <p className="muted">Connecting Moodle fills in your courses, timetable, slides and deadlines for you. Or add courses by hand below.</p>
          <div className="welcome-block">
            <h2>Connect Moodle (recommended)</h2>
            <MoodleConnect />
          </div>
          <div className="welcome-block">
            <h2>Or add courses yourself</h2>
            <CoursesEditor />
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="welcome-card">
          <h1>What do you care about?</h1>
          <p className="muted">Notices on these topics rank higher. You can change this anytime in Settings.</p>
          <div className="chips" style={{ marginTop: 16 }}>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`chip ${form.categories.includes(c) ? "on" : ""}`} aria-pressed={form.categories.includes(c)} onClick={() => toggle(c)}>
                {c}
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
          <h1>Stay in the loop</h1>
          <p className="muted">Get a buzz when a class is cancelled or something urgent lands, plus a short morning summary at 7:30.</p>
          <div className="welcome-block">
            <PushToggle />
            <DigestPicker />
          </div>
        </section>
      )}

      {error && <p className="err">{error}</p>}

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
              {saving ? "Finishing…" : "Open my board"}
            </button>
          )}
        </span>
      </div>
    </main>
  );
}
