import { Sparkles } from "lucide-react";
import { cleanSubject } from "@/lib/display";
import { whenLabel } from "@/lib/majorEvents";

export type BigEvent = { id: string; subject: string; summary?: string | null; when: string; links?: string[] | string | null };

const firstLink = (l?: string[] | string | null) => {
  const list = Array.isArray(l) ? l : typeof l === "string" ? l.split(/[\s,]+/) : [];
  return list.find((x) => /^https?:\/\//.test(x)) || null;
};

/** The institute's big events that are on now or close, shown to everyone whatever they follow. */
export function BigEvents({ events, now }: { events: BigEvent[]; now: Date }) {
  if (events.length === 0) return null;
  return (
    <section className="big-events" aria-label="Big events on campus">
      <h2>
        <Sparkles aria-hidden width={16} height={16} /> On campus
      </h2>
      <ul>
        {events.map((e) => {
          const link = firstLink(e.links);
          return (
            <li key={e.id}>
              <span className="big-when">{whenLabel(e.when, now)}</span>
              <span className="big-what">
                <b>{cleanSubject(e.subject)}</b>
                {e.summary && <span>{e.summary.slice(0, 140)}</span>}
              </span>
              {link && (
                <a href={link} target="_blank" rel="noopener noreferrer" className="big-link">
                  Details
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
