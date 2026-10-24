"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";

const typing = (el: Element | null) => {
  const t = el as HTMLElement | null;
  return !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
};

const GO: Record<string, string> = { h: "/", t: "/schedule", l: "/library", s: "/settings" };

/** Laptop shortcuts: / or Ctrl+K search, j k move, e done, s save, g then h t l s go to a page, ? help. */
export function Shortcuts() {
  const router = useRouter();
  const path = usePathname();
  const [help, setHelp] = useState(false);
  const goKey = useRef(0);

  useEffect(() => {
    const focusSearch = () => {
      const el = document.getElementById("omni");
      if (el) el.focus();
      else router.push("/?s=1");
    };
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector(".sheet")) return;
      const k = e.key;
      if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === "k") {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(document.activeElement)) return;
      if (k === "/") {
        e.preventDefault();
        focusSearch();
      } else if (k === "?") setHelp(true);
      else if (k === "g") goKey.current = Date.now();
      else if (Date.now() - goKey.current < 1200 && GO[k]) {
        goKey.current = 0;
        router.push(GO[k]);
      } else if (path === "/" && (k === "j" || k === "k" || k === "e" || k === "s")) {
        const list = [...document.querySelectorAll<HTMLElement>("article.notice")];
        const cur = list.findIndex((a) => a.contains(document.activeElement));
        if (k === "j" || k === "k") {
          const next = list[Math.max(0, Math.min(list.length - 1, cur + (k === "j" ? 1 : -1)))];
          if (next) {
            next.tabIndex = -1;
            next.focus();
            next.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        } else if (cur >= 0) {
          list[cur].querySelector<HTMLElement>(k === "e" ? '[data-act="done"]' : '[data-act="save"]')?.click();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path, router]);

  if (!help) return null;
  return (
    <Sheet title="Keyboard shortcuts" onClose={() => setHelp(false)}>
      <h2 className="sheet-title">Keyboard shortcuts</h2>
      <div className="kbd-list">
        <span>
          <kbd>/</kbd> or <kbd>Ctrl</kbd> <kbd>K</kbd>
        </span>
        <span>Search or ask</span>
        <span>
          <kbd>j</kbd> <kbd>k</kbd>
        </span>
        <span>Next / previous notice</span>
        <span>
          <kbd>e</kbd>
        </span>
        <span>Mark the notice done</span>
        <span>
          <kbd>s</kbd>
        </span>
        <span>Save the notice</span>
        <span>
          <kbd>g</kbd> then <kbd>h</kbd>
        </span>
        <span>Home</span>
        <span>
          <kbd>g</kbd> then <kbd>t</kbd>
        </span>
        <span>Timetable</span>
        <span>
          <kbd>g</kbd> then <kbd>l</kbd>
        </span>
        <span>Files</span>
        <span>
          <kbd>g</kbd> then <kbd>s</kbd>
        </span>
        <span>Settings</span>
        <span>
          <kbd>?</kbd>
        </span>
        <span>This list</span>
      </div>
    </Sheet>
  );
}
