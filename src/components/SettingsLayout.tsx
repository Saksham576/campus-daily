"use client";

import { useEffect, useState } from "react";
import { Bell, BookOpen, GraduationCap, Heart, Mail, Palette, Shield, User, type LucideIcon } from "lucide-react";

/** `rail: false` entries keep their icon for the panel but are not separate menu items (they sit inside another section). */
export const SETTINGS_SECTIONS: { id: string; label: string; Icon: LucideIcon; rail?: boolean }[] = [
  { id: "profile", label: "You", Icon: User },
  { id: "courses", label: "Courses", Icon: BookOpen },
  { id: "moodle", label: "Moodle", Icon: GraduationCap, rail: false },
  { id: "interests", label: "Interests", Icon: Heart },
  { id: "alerts", label: "Notifications", Icon: Bell },
  { id: "appearance", label: "Appearance", Icon: Palette, rail: false },
  { id: "privacy", label: "Account", Icon: Shield },
];

/** Left menu that follows the section you're reading. */
export function SettingsRail() {
  const [active, setActive] = useState("profile");
  useEffect(() => {
    const els = SETTINGS_SECTIONS.filter((s) => s.rail !== false).map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    els.forEach((el) => io.observe(el));
    // On phones one section shows at a time (CSS :target), so follow the link you tapped.
    // In-app links (Link to /settings#courses) don't set :target, so the page remembers the section itself.
    const fromHash = () => {
      const h = location.hash.slice(1);
      const known = h && SETTINGS_SECTIONS.some((s) => s.id === h);
      if (known) setActive(h);
      document.querySelector(".settings")?.setAttribute("data-panel", known ? h : "profile");
      if (known && window.matchMedia("(max-width: 640px)").matches) window.scrollTo({ top: 0 });
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => {
      io.disconnect();
      window.removeEventListener("hashchange", fromHash);
    };
  }, []);
  return (
    <nav className="rail" aria-label="Settings sections">
      {SETTINGS_SECTIONS.filter((s) => s.rail !== false).map(({ id, label, Icon }) => (
        <a key={id} href={`#${id}`} className={active === id ? "active" : ""} aria-current={active === id ? "true" : undefined}>
          <Icon aria-hidden />
          {label}
        </a>
      ))}
    </nav>
  );
}

export function Panel({ id, title, sub, children }: { id: string; title: string; sub: string; children: React.ReactNode }) {
  const Icon = SETTINGS_SECTIONS.find((s) => s.id === id)?.Icon || User;
  return (
    <section className="panel" id={id}>
      <div className="panel-head">
        <span className="panel-ico" aria-hidden>
          <Icon />
        </span>
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="panel-sub">{sub}</p>
        </div>
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

/** System / Light / Dark — the same choice as the sidebar switch. */
export function ThemePicker() {
  const [v, setV] = useState<string>("system");
  useEffect(() => {
    setV(document.documentElement.dataset.theme || "system");
  }, []);
  function pick(t: string) {
    setV(t);
    try {
      if (t === "system") {
        delete document.documentElement.dataset.theme;
        localStorage.removeItem("cd_theme");
      } else {
        document.documentElement.dataset.theme = t;
        localStorage.setItem("cd_theme", t);
      }
    } catch {}
  }
  return (
    <div className="field">
      <span>Theme</span>
      <div className="seg" role="radiogroup" aria-label="Theme">
        {(["system", "light", "dark"] as const).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={v === t} className={v === t ? "on" : ""} onClick={() => pick(t)}>
            {t === "system" ? "Match device" : t === "light" ? "Light" : "Dark"}
          </button>
        ))}
      </div>
      <span className="help">Saved on this device.</span>
    </div>
  );
}
