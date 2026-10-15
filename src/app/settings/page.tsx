"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PushToggle } from "@/components/PushToggle";
import { CoursesEditor } from "@/components/CoursesEditor";
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
  type DeliveryPreference,
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
        // Robust categories resolution: map any modern or legacy tokens to canonical CATEGORIES
        const resolvedCategories = normalizeCategories(
          Array.isArray(sub.categories) && sub.categories.length > 0
            ? sub.categories
            : sub.category
        );

        // Robust delivery preference resolution
        const resolvedDelivery = normalizeDeliveryPreference(
          sub.delivery_preference,
          sub.delivery
        );

        // Robust HASMED elective resolution (including Management)
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
          moodle_ical_url: sub.moodle_ical_url || sub.moodle_ical || "",
        });
      }
      setLoading(false);
    }
    loadData();
  }, [router]);

  function toggleCategory(cat: string) {
    setForm((prev) => {
      const exists = prev.categories.includes(cat);
      const nextCats = exists
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat];
      return { ...prev, categories: nextCats };
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

      const activeUserId = user?.id || null;
      const cleanPersonalEmail = form.personal_email?.trim().toLowerCase() || null;
      const cleanKeywords = form.keywords?.trim() || null;
      const cleanMoodleUrl = form.moodle_ical_url?.trim() || null;

      const payload: Record<string, any> = {
        email: activeEmail,
        department: form.department,
        year: form.year,
        division: form.year === "1" ? form.division : null,
        hostel: form.hostel,
        // Modern columns
        hasmed: form.year === "1" ? form.hasmed : null,
        categories: form.categories,
        keywords: cleanKeywords,
        personal_email: cleanPersonalEmail,
        delivery_preference: form.delivery_preference,
        moodle_ical_url: cleanMoodleUrl,
        // Legacy columns synchronization for zero data loss
        hasmed1: form.year === "1" ? form.hasmed : null,
        category: form.categories.join(", "),
        interests: cleanKeywords,
        delivery_email: cleanPersonalEmail,
        delivery: form.delivery_preference === "both" ? "app_email" : form.delivery_preference,
        moodle_ical: cleanMoodleUrl,
        onboarded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (activeUserId) {
        payload.user_id = activeUserId;
      }

      const { error } = await supabase.from("subscribers").upsert(
        payload,
        { onConflict: "email" }
      );

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Preferences saved successfully!");
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
    const supabase = createClient();
    await supabase.auth.signOut();
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
    if (res.ok) {
      window.location.href = "/login";
    } else {
      const j = await res.json().catch(() => ({}));
      setErrorMsg(j.error || "Could not delete your account. Please try again.");
    }
  }

  if (loading) {
    return (
      <main className="wrap narrow">
        <p className="muted">Loading your preferences…</p>
      </main>
    );
  }

  return (
    <main className="wrap narrow-form">
      <header className="top">
        <div>
          <p className="eyebrow">Settings & Preferences</p>
          <h1>{isOnboarding ? "Complete Onboarding" : "Your Profile"}</h1>
          <p className="muted">Signed in as <b>{userEmail}</b></p>
        </div>
        <div className="nav-links">
          <Link href="/" className="navlink">Feed</Link>
          <Link href="/schedule" className="navlink">Timetable</Link>
        </div>
      </header>

      {isOnboarding && (
        <p className="note">
          Welcome to Campus Daily! Customize your department, year, and interests so we only surface notices and schedule slots that matter to you.
        </p>
      )}

      {errorMsg && <p className="err">{errorMsg}</p>}
      {successMsg && <p className="note" style={{ borderColor: "var(--green)" }}>{successMsg}</p>}

      <form onSubmit={handleSubmit} className="pform">
        <fieldset>
          <legend>Academic Profile</legend>
          <div className="row2">
            <label>
              Department
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>

            <label>
              Program Year
              <select
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
              >
                {PROGRAM_YEARS.map((y) => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </label>
          </div>

          {form.year === "1" && (
            <div className="row2">
              <label>
                Division (First Year)
                <select
                  value={form.division}
                  onChange={(e) => setForm({ ...form, division: e.target.value })}
                >
                  {DIVISIONS.map((div) => (
                    <option key={div} value={div}>{div}</option>
                  ))}
                </select>
              </label>

              <label>
                HASMED Elective
                <select
                  value={form.hasmed}
                  onChange={(e) => setForm({ ...form, hasmed: e.target.value })}
                >
                  {HASMED.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label>
            Hostel
            <select
              value={form.hostel}
              onChange={(e) => setForm({ ...form, hostel: e.target.value })}
            >
              {HOSTELS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>Notice Categories & Topics</legend>
          <label>
            Select categories you want to see:
            <div className="chips" style={{ marginTop: 8 }}>
              {CATEGORIES.map((cat) => {
                const on = form.categories.includes(cat);
                return (
                  <span
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`chip ${on ? "on" : ""}`}
                  >
                    {cat}
                  </span>
                );
              })}
            </div>
          </label>

          <label style={{ marginTop: 8 }}>
            Keywords / Topics of interest (comma-separated):
            <input
              type="text"
              placeholder="e.g. MA 105, robotics, techfest, football, placement"
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Self-Updating Timetable & Moodle Sync</legend>
          <label>
            Moodle Private Calendar Export URL
            <input
              type="url"
              placeholder="https://moodle.iitb.ac.in/calendar/export.php?userid=...&authtoken=..."
              value={form.moodle_ical_url}
              onChange={(e) => setForm({ ...form, moodle_ical_url: e.target.value })}
            />
            <span className="muted small">
              Paste your private Moodle iCal URL to sync assignment and quiz deadlines directly into your timetable without storing credentials.
            </span>
            {form.moodle_ical_url && (
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/sync/moodle", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url: form.moodle_ical_url }),
                      });
                      const d = await res.json();
                      if (res.ok) {
                        alert(d.message || "Synced successfully!");
                      } else {
                        alert(d.error || "Failed to sync");
                      }
                    } catch (e: any) {
                      alert(e.message || "Could not reach sync endpoint");
                    }
                  }}
                  className="small"
                >
                  🔄 Test & Sync Deadlines Now
                </button>
              </div>
            )}
          </label>
        </fieldset>

        <fieldset>
          <legend>Digest Delivery</legend>
          <label className="radio">
            <input
              type="radio"
              name="delivery"
              value="app"
              checked={form.delivery_preference === "app"}
              onChange={() => setForm({ ...form, delivery_preference: "app" })}
            />
            Web App Only (Read here anytime)
          </label>
          <label className="radio">
            <input
              type="radio"
              name="delivery"
              value="email"
              checked={form.delivery_preference === "email"}
              onChange={() => setForm({ ...form, delivery_preference: "email" })}
            />
            Evening Email Digest (6 PM daily)
          </label>
          <label className="radio">
            <input
              type="radio"
              name="delivery"
              value="both"
              checked={form.delivery_preference === "both"}
              onChange={() => setForm({ ...form, delivery_preference: "both" })}
            />
            Both Web App & Daily Email Digest
          </label>

          <label style={{ marginTop: 8 }}>
            Secondary / Personal Email (optional)
            <input
              type="email"
              placeholder="yourname@gmail.com"
              value={form.personal_email}
              onChange={(e) => setForm({ ...form, personal_email: e.target.value })}
            />
            <span className="muted small">
              If provided, daily digests can be sent here instead of filling your LDAP inbox.
            </span>
          </label>
        </fieldset>

        <button type="submit" disabled={saving} className="primary">
          {saving ? "Saving…" : "Save Preferences"}
        </button>
      </form>

      <fieldset style={{ marginTop: 24 }}>
        <legend>My Courses (builds your timetable)</legend>
        <CoursesEditor />
      </fieldset>

      <fieldset style={{ marginTop: 24 }}>
        <legend>Phone Alerts</legend>
        <PushToggle />
      </fieldset>

      <fieldset style={{ marginTop: 24 }}>
        <legend>Your Data & Privacy</legend>
        <p className="muted small">
          Download everything we store about you, or permanently delete your account. See our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <a href="/api/account/export" className="link" download>
          Export all my data (JSON)
        </a>
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={handleDeleteAccount} className="link" style={{ color: "crimson" }}>
            Delete my account
          </button>
        </div>
      </fieldset>

      <div className="signout">
        <button onClick={handleSignOut} className="link" style={{ color: "var(--accent)" }}>
          Sign out
        </button>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="wrap narrow">
          <p className="muted">Loading settings…</p>
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

