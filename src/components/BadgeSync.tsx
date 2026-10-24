"use client";

import { useEffect } from "react";

/** Home tells the tab bar what needs attention (due soon, class changed today). */
export function BadgeSync({ due, changed }: { due: number; changed: number }) {
  useEffect(() => {
    try {
      localStorage.setItem("cd_badges", JSON.stringify({ due, changed, at: Date.now() }));
      window.dispatchEvent(new Event("cd-badges"));
    } catch {}
  }, [due, changed]);
  return null;
}
