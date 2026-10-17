"use client";

import { useEffect, useMemo, useState } from "react";
import { ItemCard, type FeedItem } from "@/components/ItemCard";
import { SponsoredCard, type Sponsored } from "@/components/SponsoredCard";
import { Bookmark, Search } from "lucide-react";

type Key = "action" | "exams" | "courses" | "events" | "opportunities" | "campus" | "saved" | "all";

const PLATFORMS: { key: Key; code: string; label: string; note: string }[] = [
  { key: "action", code: "1", label: "Action needed", note: "Deadlines & registrations — pinned until you tick Done or the date passes. Soonest first." },
  { key: "exams", code: "2", label: "Exams & quizzes", note: "Upcoming quizzes, exams and tests — soonest first. They leave once they're over." },
  { key: "courses", code: "3", label: "My courses", note: "Anything about the courses you take, plus verified instructor posts." },
  { key: "events", code: "4", label: "Events", note: "Upcoming talks, workshops and fests — ordered by start time. Past events leave by themselves." },
  { key: "opportunities", code: "5", label: "Opportunities", note: "Internships, competitions, scholarships." },
  { key: "campus", code: "6", label: "Campus life", note: "Hostel, mess, sports and WhatsApp group announcements." },
  { key: "saved", code: "7", label: "Saved", note: "Everything you starred. Stays here even after it expires." },
  { key: "all", code: "8", label: "Everything", note: "Every notice, newest first." },
];

export function FeedView({
  sections,
  sponsored,
}: {
  sections: Record<Key, FeedItem[]>;
  sponsored?: Sponsored | null;
}) {
  const [tab, setTab] = useState<Key>("action");
  const [q, setQ] = useState("");

  // Remember the last platform on this device; start on Action if anything is due.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cd_tab") as Key | null;
      if (sections.action.length === 0 && saved && saved !== "action") setTab(saved);
      else if (sections.action.length === 0) setTab("courses");
    } catch {}
  }, [sections.action.length]);

  function pick(k: Key) {
    setTab(k);
    try {
      localStorage.setItem("cd_tab", k);
    } catch {}
  }

  const dueSoon = sections.action.some((i) => i.when && new Date(i.when).getTime() - Date.now() < 48 * 3600_000);

  const shown = useMemo(() => {
    const list = q.trim() ? sections.all : sections[tab];
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter((i) =>
      `${i.subject} ${i.summary || ""} ${i.from_address || ""} ${i.body || ""}`.toLowerCase().includes(needle)
    );
  }, [q, tab, sections]);

  const meta = PLATFORMS.find((p) => p.key === tab)!;
  // Main sections as tabs (empty ones step aside); Saved and Everything sit by the search box.
  const MAIN: Key[] = ["action", "exams", "courses", "events", "opportunities", "campus"];
  const tabs = PLATFORMS.filter((p) => MAIN.includes(p.key) && (p.key === "action" || p.key === tab || sections[p.key].length > 0));

  return (
    <>
      <nav className="platforms" aria-label="Sections">
        {tabs.map((p) => (
          <button
            key={p.key}
            className={`platform ${tab === p.key && !q ? "active" : ""} ${p.key === "action" && dueSoon ? "urgent" : ""}`}
            onClick={() => {
              setQ("");
              pick(p.key);
            }}
            aria-pressed={tab === p.key}
          >
            <span className="label">{p.label}</span>
            <span className="count">{sections[p.key].length}</span>
          </button>
        ))}
      </nav>

      <div className="search">
        <span className="search-ico" aria-hidden>
          <Search width={16} height={16} />
        </span>
        <input
          type="search"
          placeholder="Search notices"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search notices"
        />
        {(["saved", "all"] as Key[]).map((k) => (
          <button
            key={k}
            className={`search-chip ${tab === k && !q ? "active" : ""}`}
            onClick={() => {
              setQ("");
              pick(k);
            }}
            aria-pressed={tab === k}
          >
            {k === "saved" ? <><Bookmark aria-hidden /> Saved</> : "All"} <span className="count">{sections[k].length}</span>
          </button>
        ))}
      </div>

      <p className="section-note">
        {q ? `${shown.length} result${shown.length === 1 ? "" : "s"} for "${q}"` : meta.note}
      </p>

      {shown.length === 0 ? (
        <div className="empty">
          {q ? "Nothing matches that search." : tab === "action" ? "Nothing due. You're all clear." : "Nothing here right now."}
        </div>
      ) : (
        <div className="tickets">
          {shown.map((it, idx) => (
            <div key={it.id || it.item_id}>
              {idx === 2 && sponsored && !q && <SponsoredCard card={sponsored} />}
              <ItemCard item={it} />
            </div>
          ))}
          {shown.length <= 2 && sponsored && !q && <SponsoredCard card={sponsored} />}
        </div>
      )}
    </>
  );
}
