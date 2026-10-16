"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const istClock = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

export function AppBar() {
  const path = usePathname();
  const [clock, setClock] = useState("");
  useEffect(() => {
    setClock(istClock());
    const t = setInterval(() => setClock(istClock()), 15_000);
    return () => clearInterval(t);
  }, []);

  const nav = [
    { href: "/", label: "Home", icon: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
    { href: "/schedule", label: "Timetable", icon: <><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></> },
    {
      href: "/settings",
      label: "Settings",
      icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    },
  ];

  return (
    <header className="appbar">
      <div className="appbar-in">
        <Link href="/" className="brand" aria-label="Campus Daily home">
          <span className="brand-deva" lang="hi">कैंपस डेली</span>
          <span className="brand-mark">Campus Daily</span>
          <span className="brand-sub">IIT Bombay · Powai</span>
        </Link>
        <nav className="appnav" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? "active" : ""} aria-current={path === n.href ? "page" : undefined}>
              <svg className="nav-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {n.icon}
              </svg>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <span className="clock" aria-label="Time in IST">
          {clock}
        </span>
      </div>
    </header>
  );
}
