"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PushToggle } from "@/components/PushToggle";
import { DigestPicker } from "@/components/DigestPicker";
import { Panel, SettingsRail, ThemePicker } from "@/components/SettingsLayout";
import { CoursesEditor } from "@/components/CoursesEditor";
import { CoursePicker } from "@/components/CoursePicker";
import { MoodleConnect } from "@/components/MoodleConnect";
import { CalendarLink } from "@/components/CalendarLink";
import { AppBar } from "@/components/AppBar";
import {
  DEPARTMENTS,
  PROGRAM_YEARS,
  DIVISIONS,
  HASMED,
  HOSTELS,
  CATEGORIES,
  normalizeCategories,
  normalizeDeliveryPreference,
  type Profile,
} from "@/lib/constants";

const DELIVERY = [
  ["app", "Board only", "Read here whenever you like."],
  ["email", "Evening email digest", "One email at 6 PM with what matters."],
  ["both", "Board + evening email", "Both."],
] as const;

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState<Profile>({
    department: DEPARTMENTS[0],
    year: "1",
    division: "D1",
    hostel: "Hostel 16",
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
          department: sub.department || DEPARTMENTS[0],
          year: sub.year ? String(sub.year) : "1",
          division: sub.division || "D1",
          hostel: sub.hostel || "Hostel 16",
          hasmed: resolvedHasmed,
          categories: resolvedCategories,
          keywords: sub.keywords || sub.interests || "",
          personal_email: sub.personal_email || sub.delivery_email || "",
          delivery_preference: resolvedDelivery,
          moodle_ical_url: "",
        });
      }
      setLoading(false);
    }
    loadData();
  }, [router]);

  function toggleCategory(cat: string) {
    setForm((prev) => {
      const exists = prev.categories.includes(cat);
      return { ...prev, categories: exists ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat] };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        department: form.department,
        year: form.year,
        division: form.year === "1" ? form.division : null,
        hostel: form.hostel,
        hasmed: form.year === "1" ? form.hasmed : null,
        categories: form.categories,
        keywords: cleanKeywords,
        personal_email: cleanPersonalEmail,
        delivery_preference: form.delivery_preference,
        // Legacy columns kept in sync for the old digest script
        hasmed1: form.year === "1" ? form.hasmed : null,
        category: form.categories.join(", "),
        interests: cleanKeywords,
        delivery_email: cleanPersonalEmail,
        delivery: form.delivery_preference === "both" ? "app_email" : form.delivery_preference,
        onboarded_at: new Date().toISOString(),
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
        <main className="wrap">
          <p className="muted" style={{ paddingTop: 40 }}>Loading your settings…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppBar />
      <main className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">Signed in as {userEmail}</p>
            <h1>{isOnboarding ? "Set up your board" : "Settings"}</h1>
          </div>
        </div>

        {isOnboarding && (
          <p className="note">Welcome! Fill in your profile and add your courses — that&apos;s what lights up your board and your week.</p>
        )}
        {errorMsg && <p className="err">{errorMsg}</p>}

        <div className="settings">
          <SettingsRail />

          <form onSubmit={handleSubmit} className="panels">
            <Panel id="profile" title="Profile" sub="Used to pick notices meant for you — department, year and hostel.">
              <div className="row2">
                <label className="field">
                  Department
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
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

            <Panel id="courses" title="My courses" sub="Your timetable is built from these. Pick your division and the slots fill in from ResoBin.">
              <CoursePicker division={form.division || ""} department={form.department} />
              <details className="more-courses">
                <summary>A course isn&apos;t listed? Add it by code</summary>
                <CoursesEditor />
              </details>
            </Panel>

            <Panel
              id="moodle"
              title="Moodle"
              sub="Connect once: announcements, slides and PDFs (like seating plans) from your courses reach your board automatically."
            >
              <MoodleConnect />
            </Panel>

            <Panel id="interests" title="Interests" sub="Topics you care about rank higher. Keywords can be clubs, sports or anything else.">
              <div className="chips">
                {CATEGORIES.map((cat) => {
                  const on = form.categories.includes(cat);
                  return (
                    <span
                      key={cat}
                      role="checkbox"
                      aria-checked={on}
                      tabIndex={0}
                      onClick={() => toggleCategory(cat)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggleCategory(cat);
                        }
                      }}
                      className={`chip ${on ? "on" : ""}`}
                    >
                      {cat}
                    </span>
                  );
                })}
              </div>
              <label className="field">
                Keywords
                <input
                  type="text"
                  placeholder="e.g. robotics, techfest, football, placement"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                />
                <span className="help">Comma-separated.</span>
              </label>
            </Panel>

            <Panel id="delivery" title="Delivery" sub="Where you want your notices.">
              {DELIVERY.map(([v, title, sub]) => (
                <label key={v} className="choice">
                  <input
                    type="radio"
                    name="delivery"
                    value={v}
                    checked={form.delivery_preference === v}
                    onChange={() => setForm({ ...form, delivery_preference: v })}
                  />
                  <span>
                    <b>{title}</b>
                    <br />
                    <span className="help">{sub}</span>
                  </span>
                </label>
              ))}
              <label className="field">
                Personal email (optional)
                <input
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={form.personal_email}
                  onChange={(e) => setForm({ ...form, personal_email: e.target.value })}
                />
                <span className="help">Send digests here instead of your IITB inbox.</span>
              </label>
            </Panel>

            <Panel id="alerts" title="Alerts & calendar" sub="Phone alerts for cancellations and top-priority notices, and a live calendar link.">
              <PushToggle />
              <DigestPicker />
              <div style={{ marginTop: 16 }}>
                <CalendarLink />
              </div>
            </Panel>

            <Panel id="appearance" title="Appearance" sub="Light or dark. You can also switch from the sidebar.">
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

            <div className="save-bar">
              <span>{successMsg || "Profile, interests and delivery save together."}</span>
              <button type="submit" disabled={saving} className="primary">
                {saving ? "Saving…" : isOnboarding ? "Save & open my board" : "Save"}
              </button>
            </div>
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
        <main className="wrap">
          <p className="muted">Loading settings…</p>
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
