"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Light / dark switch. Starts from the device setting; your choice is remembered on this device. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const set = document.documentElement.dataset.theme;
    setDark(set ? set === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("cd_theme", theme);
    } catch {}
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      suppressHydrationWarning
    >
      {dark === null ? <Moon aria-hidden /> : dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
      <span className="theme-label">{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
