"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ItemCard, type FeedItem } from "@/components/ItemCard";
import { SponsoredCard, type Sponsored } from "@/components/SponsoredCard";
import { AskBox } from "@/components/AskBox";
import { DocHits } from "@/components/DocSearch";
import { Bookmark, Search, Settings, Sparkles } from "lucide-react";

type Key = "action" | "exams" | "courses" | "events" | "opportunities" | "campus" | "saved" | "all";
type View = "foryou" | "explore" | "saved";
type Chip = "everything" | "events" | "opportunities" | "campus";

const GROUPS: { key: Key; label: string; note: string }[] = [
  { key: "action", label: "Due soon", note: "Deadlines and registrations, soonest first." },
  { key: "exams", label: "Exams & quizzes", note: "Soonest first." },
  { key: "courses", label: "My courses", note: "Notices about the courses you take." },
];
const CHIPS: { key: Chip; label: string }[] = [
  { key: "everything", label: "All" },
  { key: "events", label: "Events" },
  { key: "opportunities", label: "Opportunities" },
  { key: "campus", label: "Campus life" },
];

// Settings you can jump to straight from the search box.
const SETTING_LINKS = [
  { label: "Alerts and notifications", href: "/settings#alerts", k: ["alert", "notification", "push", "phone"] },
  { label: "Morning digest email", href: "/settings#alerts", k: ["digest", "email"] },
  { label: "Division, department and year", href: "/settings#profile", k: ["division", "department", "year", "hostel", "profile", "name"] },
  { label: "My courses, labs and tutorials", href: "/settings#courses", k: ["course", "slot", "tutorial", "lab", "batch"] },
  { label: "Clubs and interests", href: "/settings#interests", k: ["club", "interest", "keyword", "follow"] },
  { label: "Moodle connection", href: "/settings#moodle", k: ["moodle"] },
  { label: "Dark mode and theme", href: "/settings#appearance", k: ["dark", "theme", "light", "appearance"] },
  { label: "Account and sign out", href: "/settings#privacy", k: ["account", "delete", "sign out", "logout"] },
];

const SUGGESTIONS = ["When is my next quiz?", "What's due this week?", "Get my morning digest by email"];

export function FeedView({
  sections,
  sponsored,
}: {
  sections: Record<Key, FeedItem[]>;
  sponsored?: Sponsored | null;
}) {
  const [view, setView] = useState<View>("foryou");
  const [chip, setChip] = useState<Chip>("everything");
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [request, setRequest] = useState<{ text: string; id: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const params = useSearchParams();

  const foryouCount = sections.action.length + sections.exams.length + sections.courses.length;
  const exploreOf = (c: Chip): FeedItem[] =>
    c === "everything" ? [...sections.events, ...sections.opportunities, ...sections.campus] : sections[c];

  // Remember the last view on this device; open on "For you" unless it is empty and Explore has news.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cd_view") as View | null;
      if (foryouCount === 0 && exploreOf("everything").length > 0) setView("explore");
      else if (saved === "explore" || saved === "saved") setView(saved);
    } catch {}
    if (params.get("s")) input.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(v: View) {
    setView(v);
    setQ("");
    try {
      localStorage.setItem("cd_view", v);
    } catch {}
  }

  const dueSoon = sections.action.some((i) => i.when && new Date(i.when).getTime() - Date.now() < 48 * 3600_000);
  const needle = q.trim().toLowerCase();
  const found = useMemo(
    () =>
      needle
        ? sections.all.filter((i) => `${i.subject} ${i.summary || ""} ${i.from_address || ""} ${i.body || ""}`.toLowerCase().includes(needle))
        : [],
    [needle, sections.all]
  );
  const settingHits = needle.length >= 3 ? SETTING_LINKS.filter((s) => s.k.some((k) => needle.includes(k) || (needle.length >= 4 && k.startsWith(needle)))).slice(0, 3) : [];

  function ask(text: string) {
    if (text.trim().length < 3) return;
    setRequest({ text: text.trim(), id: Date.now() });
    setQ("");
    setFocused(false);
  }

  const card = (it: FeedItem, i: number, withSponsor: boolean) => (
    <div key={it.id || it.item_id}>
      {withSponsor && i === 2 && sponsored && <SponsoredCard card={sponsored} />}
      <ItemCard item={it} />
    </div>
  );

  let body: React.ReactNode;
  if (needle) {
    body = (
      <>
        <h2 className="group-title">
          Notices <span className="count">{found.length}</span>
        </h2>
        {found.length === 0 ? <div className="empty">No notice matches that.</div> : <div className="tickets">{found.map((it, i) => card(it, i, false))}</div>}
      </>
    );
  } else if (view === "foryou") {
    const any = foryouCount > 0;
    let n = 0;
    body = any ? (
      <div className="groups">
        {GROUPS.filter((g) => sections[g.key].length).map((g) => (
          <section key={g.key} className="group" aria-label={g.label}>
            <h2 className="group-title">
              {g.label} <span className="count">{sections[g.key].length}</span>
            </h2>
            <p className="section-note">{g.note}</p>
            <div className="tickets">{sections[g.key].map((it) => card(it, n++, true))}</div>
          </section>
        ))}
        {foryouCount <= 2 && sponsored && <SponsoredCard card={sponsored} />}
      </div>
    ) : (
      <div className="empty">Nothing due. You&apos;re all clear. Try Explore for events and opportunities.</div>
    );
  } else if (view === "explore") {
    const list = exploreOf(chip);
    body = (
      <>
        <div className="chips-row" role="group" aria-label="Filter">
          {CHIPS.map((c) => (
            <button key={c.key} type="button" className={`search-chip ${chip === c.key ? "active" : ""}`} aria-pressed={chip === c.key} onClick={() => setChip(c.key)}>
              {c.label} <span className="count">{exploreOf(c.key).length}</span>
            </button>
          ))}
        </div>
        {list.length === 0 ? <div className="empty">Nothing here right now.</div> : <div className="tickets">{list.map((it, i) => card(it, i, true))}</div>}
      </>
    );
  } else {
    body = (
      <>
        <h2 className="group-title">
          Saved <span className="count">{sections.saved.length}</span>
        </h2>
        {sections.saved.length === 0 ? (
          <div className="empty">Nothing saved yet. Tap Save on a notice, or swipe it left, and it waits here.</div>
        ) : (
          <div className="tickets">{sections.saved.map((it, i) => card(it, i, false))}</div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="search" role="search">
        <span className="search-ico" aria-hidden>
          <Search width={16} height={16} />
        </span>
        <input
          ref={input}
          id="omni"
          type="search"
          placeholder="Search or ask…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (q.includes("?") || q.trim().split(/\s+/).length >= 4)) ask(q);
            if (e.key === "Escape") {
              setQ("");
              input.current?.blur();
            }
          }}
          aria-label="Search notices, files and settings, or ask a question"
        />
        <button type="button" className={`search-chip saved-btn ${view === "saved" && !q ? "active" : ""}`} onClick={() => pick(view === "saved" ? "foryou" : "saved")} aria-pressed={view === "saved"} aria-label={`Saved notices (${sections.saved.length})`}>
          <Bookmark aria-hidden />
          <span className="count">{sections.saved.length}</span>
        </button>
      </div>

      {focused && !needle && (
        <div className="ask-sugg omni-sugg">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ask(s)}>
              <Sparkles aria-hidden /> {s}
            </button>
          ))}
        </div>
      )}
      {needle.length >= 3 && (
        <div className="omni-extra">
          <button type="button" className="omni-row" onClick={() => ask(q)}>
            <Sparkles aria-hidden />
            <span>
              Ask “{q.trim()}”
            </span>
          </button>
          {settingHits.map((s) => (
            <Link key={s.label} href={s.href} className="omni-row">
              <Settings aria-hidden />
              <span>Settings: {s.label}</span>
            </Link>
          ))}
        </div>
      )}

      <AskBox request={request} />

      {needle.length >= 3 && <DocHits q={q} />}

      {!needle && (
        <nav className="platforms" aria-label="Views" role="tablist">
          <button type="button" role="tab" aria-selected={view === "foryou"} className={`platform ${view === "foryou" ? "active" : ""} ${dueSoon ? "urgent" : ""}`} onClick={() => pick("foryou")}>
            <span className="label">For you</span>
            <span className="count">{foryouCount}</span>
          </button>
          <button type="button" role="tab" aria-selected={view === "explore"} className={`platform ${view === "explore" ? "active" : ""}`} onClick={() => pick("explore")}>
            <span className="label">Explore</span>
            <span className="count">{exploreOf("everything").length}</span>
          </button>
        </nav>
      )}

      {body}
    </>
  );
}
