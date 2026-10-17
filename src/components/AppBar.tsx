"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, House, LibraryBig, Settings } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const istClock = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

const NAV = [
  { href: "/", label: "Home", Icon: House },
  { href: "/schedule", label: "Timetable", Icon: CalendarDays },
  { href: "/library", label: "Library", Icon: LibraryBig },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function AppBar() {
  const path = usePathname();
  const [clock, setClock] = useState("");
  useEffect(() => {
    setClock(istClock());
    const t = setInterval(() => setClock(istClock()), 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="appbar">
      <div className="appbar-in">
        <Link href="/" className="brand" aria-label="Campus Daily home">
          <Logo />
          <span className="brand-text">
            <span className="brand-mark">Campus Daily</span>
            <span className="brand-sub">IIT Bombay</span>
          </span>
        </Link>
        <nav className="appnav" aria-label="Main">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                <Icon aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="appbar-foot">
          <ThemeToggle />
          <span className="clock" aria-label="Time in IST">
            {clock && `${clock} IST`}
          </span>
        </div>
      </div>
    </header>
  );
}
