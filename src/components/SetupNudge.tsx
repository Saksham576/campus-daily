"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type Nudge = { id: string; title: string; body: string; href: string; cta: string };

const KEY = (id: string) => `cd_nudge_${id}`;

/**
 * "Finish setting up": what's new or still missing for students who signed up before it existed
 * (lab / tutorial slots, alerts, clubs, Moodle). Two at a time, each dismissible, remembered on the device.
 */
export function SetupNudges({ nudges }: { nudges: Nudge[] }) {
  const [hidden, setHidden] = useState<string[] | null>(null);

  useEffect(() => {
    const gone: string[] = [];
    for (const n of nudges) {
      try {
        if (localStorage.getItem(KEY(n.id))) gone.push(n.id);
      } catch {}
    }
    setHidden(gone);
  }, [nudges]);

  if (hidden === null) return null;
  const shown = nudges.filter((n) => !hidden.includes(n.id)).slice(0, 2);
  if (!shown.length) return null;

  return (
    <section className="nudges" aria-label="Finish setting up">
      {shown.map((n) => (
        <div key={n.id} className="nudge">
          <div>
            <b>{n.title}</b>
            <span>{n.body}</span>
            <Link href={n.href} className="navlink">
              {n.cta}
            </Link>
          </div>
          <button
            type="button"
            className="ghost"
            aria-label="Dismiss"
            onClick={() => {
              try {
                localStorage.setItem(KEY(n.id), "1");
              } catch {}
              setHidden((h) => [...(h || []), n.id]);
            }}
          >
            <X aria-hidden />
          </button>
        </div>
      ))}
    </section>
  );
}
