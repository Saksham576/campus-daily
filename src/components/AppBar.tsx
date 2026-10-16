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
    { href: "/", label: "Board" },
    { href: "/schedule", label: "Week" },
    { href: "/settings", label: "Settings" },
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
            <Link key={n.href} href={n.href} className={path === n.href ? "active" : ""}>
              {n.label}
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
