"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PushToggle } from "@/components/PushToggle";
import { DigestPicker } from "@/components/DigestPicker";
import { Panel, SettingsRail, ThemePicker } from "@/components/SettingsLayout";
import { CoursesEditor } from "@/components/CoursesEditor";
import { CoursePicker } from "@/components/CoursePicker";
import { ResobinImport } from "@/components/ResobinImport";
import { MoodleConnect } from "@/components/MoodleConnect";
import { CalendarLink } from "@/components/CalendarLink";
import { InterestPicker } from "@/components/InterestPicker";
import { RequestBox } from "@/components/RequestBox";
import { MyInstagram } from "@/components/MyInstagram";
import type { FeedMode } from "@/lib/relevance";
import { AppBar } from "@/components/AppBar";
import {
  DEPARTMENTS,
  PROGRAM_YEARS,
  DIVISIONS,
  HASMED,
  HOSTELS,
  CATEGORIES,
  CLUBS,
  WANTS,
  normalizeCategories,
  normalizeDeliveryPreference,
  type Profile,
} from "@/lib/constants";

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [feedMode, setFeedMode] = useState<FeedMode>("balanced");
  const prefsBase = useRef<string | null>(null);
  const [form, setForm] = useState<Profile>({
    department: "",
    year: "1",
    division: "",
    hostel: "",
    hasmed: HASMED[0],
    categories: [...CATEGORIES],
    keywords: "",
    personal_email: "",
    delivery_preference: "app",
    moodle_ical_url: "",
  });

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserEmail(user.email || "");

      const emailLower = (user.email || "").toLowerCase().trim();
      const { data: sub } = await supabase
        .from("subscribers")
        .select("*")
        .or(`email.eq.${user.email},email.ilike.${emailLower}`)
        .maybeSingle();

      if (sub) {
        const resolvedCategories = normalizeCategories(
          Array.isArray(sub.categories) && sub.categories.length > 0 ? sub.categories : sub.category
        );
        const resolvedDelivery = normalizeDeliveryPreference(sub.delivery_preference, sub.delivery);
        const rawHasmed = sub.hasmed || sub.hasmed1 || HASMED[0];
        const resolvedHasmed = HASMED.includes(rawHasmed) ? rawHasmed : HASMED[0];
        setForm({
          department: sub.department || "",
          year: sub.year ? String(sub.year) : "1",
          division: sub.division || "",
          hostel: sub.hostel || "",
          hasmed: resolvedHasmed,
          categories: resolvedCategories,
          keywords: sub.keywords || sub.interests || "",
          personal_email: sub.personal_email || sub.delivery_email || "",
          delivery_preference: resolvedDelivery,
          moodle_ical_url: "",
        });
        setFeedMode((sub.feed_mode as FeedMode) || "balanced");
      }
      setLoading(false);
    }
    loadData();
  }, [router]);

  // Clubs and "also tell me about" chips live in the keywords box, so they stay editable.
  const kwList = (form.keywords || "").split(",").map((x) => x.trim()).filter(Boolean);
  const hasKw = (kw: string) => kwList.some((x) => x.toLowerCase() === kw.toLowerCase());
  const toggleKw = (kw: string) =>
    setForm((f) => {
      const list = (f.keywords || "").split(",").map((x) => x.trim()).filter(Boolean);
      const on = list.some((x) => x.toLowerCase() === kw.toLowerCase());
      return { ...f, keywords: (on ? list.filter((x) => x.toLowerCase() !== kw.toLowerCase()) : [...list, kw]).join(", ") };
    });

  function toggleCategory(cat: string) {
    setForm((prev) => {
      const exists = prev.categories.includes(cat);
      return { ...prev, categories: exists ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat] };
    });
  }

  // Saves by itself a moment after you stop changing things (not during first-time setup, which ends with a button).
  const lastSaved = useRef<string | null>(null);
  useEffect(() => {
    if (loading || isOnboarding) return;
    const now = JSON.stringify([form, feedMode]);
    if (lastSaved.current === null) {
      lastSaved.current = now;
      prefsBase.current = JSON.stringify([form.categories, form.keywords, feedMode]);
      return;
    }
    if (now === lastSaved.current) return;
    const t = setTimeout(() => {
      lastSaved.current = now;
      handleSubmit(undefined, true);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, feedMode, loading, isOnboarding]);

  async function handleSubmit(e?: React.FormEvent, auto = false) {
    e?.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const activeEmail = (user?.email || userEmail).trim().toLowerCase();
      if (!activeEmail) {
        setErrorMsg("Your session has expired. Please sign in again.");
        router.push("/login");
        return;
      }
      const cleanPersonalEmail = form.personal_email?.trim().toLowerCase() || null;
      const cleanKeywords = form.keywords?.trim() || null;
      const payload: Record<string, any> = {
        email: activeEmail,
        ...(form.department ? { department: form.department } : {}),
        year: form.year,
        division: form.year === "1" && form.division ? form.division : null,
        ...(form.hostel ? { hostel: form.hostel } : {}),
        categories: form.categories,
        keywords: cleanKeywords,
        feed_mode: feedMode,
        ...(JSON.stringify([form.categories, form.keywords, feedMode]) !== prefsBase.current || isOnboarding ? { prefs_set_at: new Date().toISOString() } : {}),
        personal_email: cleanPersonalEmail,
        delivery_preference: form.delivery_preference,
        // Legacy columns kept in sync for the old digest script
        category: form.categories.join(", "),
        interests: cleanKeywords,
        delivery_email: cleanPersonalEmail,
        delivery: form.delivery_preference === "both" ? "app_email" : form.delivery_preference,
        ...(auto ? {} : { onboarded_at: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
      };
      if (user?.id) payload.user_id = user.id;

      const { error } = await supabase.from("subscribers").upsert(payload, { onConflict: "email" });
      if (error) setErrorMsg(error.message);
      else {
        setSuccessMsg("Saved");
        if (isOnboarding) {
          router.refresh();
          router.push("/");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  async function handleDeleteAccount() {
    const typed = window.prompt(
      "This permanently deletes your account, profile and timetable. It cannot be undone.\n\nType DELETE to confirm."
    );
    if (typed !== "DELETE") return;
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    if (res.ok) window.location.href = "/login";
    else {
      const j = await res.json().catch(() => ({}));
      setErrorMsg(j.error || "Could not delete your account. Please try again.");
    }
  }

  if (loading) {
    return (
      <>
        <AppBar />
        <main id="main" className="wrap">
          <p className="muted" style={{ paddingTop: 40 }}>Loading your settings…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppBar />
      <main id="main" className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">Signed in as {userEmail}</p>
            <h1>{isOnboarding ? "Set up Campus Daily" : "Settings"}</h1>
          </div>
        </div>

        {isOnboarding && (
          <p className="note">Welcome! Fill in your profile and add your courses — that&apos;s what lights up your board and your week.</p>
        )}
        {errorMsg && <p className="err">{errorMsg}</p>}

        <div className="settings">
          <SettingsRail />

          <form
            onSubmit={handleSubmit}
            className="panels"
            onKeyDown={(e) => {
              // Enter in the course search / add-by-code boxes must not save the whole profile.
              const el = e.target as HTMLElement;
              if (e.key === "Enter" && el.tagName === "INPUT" && (el as HTMLInputElement).type !== "checkbox" && el.closest("[data-nosubmit]")) e.preventDefault();
            }}
          >
            <Panel id="profile" title="Profile" sub="Used to pick notices meant for you — department, year and hostel.">
              <div className="row2">
                <label className="field">
                  Department
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                    <option value="" disabled>
                      Choose…
                    </option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Program year
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
                      <option key={h} value={h}>
                        {h}
                      </option>
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
                      {DIVISIONS.map((div) => (
                        <option key={div} value={div}>
                          {div}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </Panel>

            <Panel id="courses" title="My courses" sub="Your timetable is built from these.">
              <div data-nosubmit>
                <CoursePicker division={form.division || ""} department={form.department} year={form.year} />
                <details className="more-courses">
                  <summary>A course isn&apos;t listed? Add it by code</summary>
                  <CoursesEditor />
                </details>
                <details className="welcome-block welcome-more">
                  <summary>
                    <b>On a laptop? Import from ResoBin for an exact timetable</b>
                    <span className="help">Copies your exact courses, labs and rooms. Needs the Campus Daily Connect extension.</span>
                  </summary>
                  <ResobinImport onDone={() => window.location.reload()} />
                </details>
              </div>
            </Panel>

            <Panel
              id="moodle"
              title="Moodle"
              sub="Connect once: announcements, slides and PDFs (like seating plans) from your courses reach your board automatically."
            >
              <MoodleConnect />
            </Panel>

            <Panel id="interests" title="What you follow" sub="Home shows what matters to you first. Everything else waits in Explore.">
              <div data-nosubmit>
                <InterestPicker
                  value={{ categories: form.categories, keywords: form.keywords || "", feed_mode: feedMode }}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, categories: v.categories, keywords: v.keywords }));
                    setFeedMode(v.feed_mode);
                  }}
                />
                <h3 className="chips-title">Instagram pages you follow</h3>
                <MyInstagram />
                <h3 className="chips-title">Something we don&apos;t cover yet?</h3>
                <p className="help">Tell us a group, page or service you wish was here. We read every one.</p>
                <RequestBox context="settings" />
              </div>
            </Panel>

            <Panel id="alerts" title="Alerts & calendar" sub="Phone alerts for cancellations and top-priority notices, the morning digest, and a live calendar link.">
              <PushToggle />
              <DigestPicker />
              <label className="field" style={{ marginTop: 14 }}>
                Email for the digest (optional)
                <input
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={form.personal_email}
                  onChange={(e) => setForm({ ...form, personal_email: e.target.value })}
                />
                <span className="help">Leave empty to use your IITB address. Saved with the Save button below.</span>
              </label>
              <div style={{ marginTop: 16 }}>
                <CalendarLink />
              </div>
            </Panel>

            <Panel id="appearance" title="Appearance" sub="Light or dark. You can also use the sun / moon button at the top.">
              <ThemePicker />
            </Panel>

            <Panel id="privacy" title="Data & privacy" sub="Download everything we store about you, or delete your account.">
              <div className="list-row">
                <span>
                  Export all my data (JSON) · <Link href="/privacy">privacy policy</Link>
                </span>
                <a href="/api/account/export" className="navlink" download>
                  Download
                </a>
              </div>
              <div className="list-row">
                <span>Sign out of this device</span>
                <button type="button" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
              <div className="list-row">
                <span>
                  <b>Delete my account</b>
                  <br />
                  <span className="help">Removes your profile, courses and Moodle connection for good.</span>
                </span>
                <button type="button" className="danger" onClick={handleDeleteAccount}>
                  Delete
                </button>
              </div>
            </Panel>

            {isOnboarding ? (
              <div className="save-bar">
                <span>{successMsg || "Profile, interests and email save together."}</span>
                <button type="submit" disabled={saving} className="primary">
                  {saving ? "Saving…" : "Save and finish"}
                </button>
              </div>
            ) : (
              <p className="help" role="status" style={{ textAlign: "center", margin: "12px 0 0" }}>
                {saving ? "Saving…" : errorMsg ? errorMsg : successMsg ? "Saved ✓" : "Changes save automatically."}
              </p>
            )}
          </form>
        </div>
      </main>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main id="main" className="wrap">
          <p className="muted">Loading settings…</p>
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
