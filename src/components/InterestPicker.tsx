"use client";

import { Check } from "lucide-react";
import { CATEGORIES, FEED_MODES, INTEREST_GROUPS } from "@/lib/constants";
import { parseKeywords, type FeedMode } from "@/lib/relevance";

export type Prefs = { categories: string[]; keywords: string; feed_mode: FeedMode };

/**
 * What you follow, and how strict Home should be. Used in first-time setup and in Settings.
 * Clubs and interests are saved as keywords (one comma-separated list), so they stay editable by hand.
 */
export function InterestPicker({ value, onChange }: { value: Prefs; onChange: (v: Prefs) => void }) {
  const kws = parseKeywords(value.keywords);
  const has = (k: string) => kws.some((x) => x.toLowerCase() === k.toLowerCase());
  const toggleKw = (k: string) =>
    onChange({ ...value, keywords: (has(k) ? kws.filter((x) => x.toLowerCase() !== k.toLowerCase()) : [...kws, k]).join(", ") });
  // Ticking all seven topics says nothing, so start from none and let people choose.
  const allTopics = value.categories.length >= CATEGORIES.length;
  const topicOn = (c: string) => !allTopics && value.categories.includes(c);
  const toggleTopic = (c: string) => {
    const base = allTopics ? [] : value.categories;
    onChange({ ...value, categories: base.includes(c) ? base.filter((x) => x !== c) : [...base, c] });
  };
  const known = new Set(INTEREST_GROUPS.flatMap((g) => g.chips.map((c) => c.toLowerCase())));
  const custom = kws.filter((k) => !known.has(k.toLowerCase()));

  const chip = (label: string, on: boolean, click: () => void) => (
    <button key={label} type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={click}>
      {on && <Check aria-hidden className="chip-tick" />}
      {label}
    </button>
  );

  return (
    <div className="interest-picker">
      <h3 className="chips-title" style={{ marginTop: 0 }}>
        Kinds of notices
      </h3>
      <div className="chips">{CATEGORIES.map((c) => chip(c, topicOn(c), () => toggleTopic(c)))}</div>

      {INTEREST_GROUPS.map((g) => (
        <section key={g.title}>
          <h3 className="chips-title">
            {g.title} <span className="help">{g.hint}</span>
          </h3>
          <div className="chips">{g.chips.map((c) => chip(c, has(c), () => toggleKw(c)))}</div>
        </section>
      ))}

      <label className="field" style={{ marginTop: 18 }}>
        Anything else (optional)
        <input
          type="text"
          placeholder="e.g. ERC, Aavhan, chess, UROP"
          value={custom.join(", ")}
          onChange={(e) => {
            const chosen = kws.filter((k) => known.has(k.toLowerCase()));
            onChange({ ...value, keywords: [...chosen, ...parseKeywords(e.target.value)].join(", ") });
          }}
        />
        <span className="help">Club names, sports, topics. Separate with commas.</span>
      </label>

      <h3 className="chips-title">How much should Home show?</h3>
      <div className="mode-list" role="radiogroup" aria-label="How much Home shows">
        {FEED_MODES.map((m) => (
          <button key={m.key} type="button" role="radio" aria-checked={value.feed_mode === m.key} className={`mode ${value.feed_mode === m.key ? "on" : ""}`} onClick={() => onChange({ ...value, feed_mode: m.key })}>
            <b>{m.label}</b>
            <span>{m.hint}</span>
          </button>
        ))}
      </div>
      <p className="help">Whatever Home hides is still in Explore. You can change this any time in Settings.</p>
    </div>
  );
}
