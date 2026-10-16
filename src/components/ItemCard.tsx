"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  extractEventDetails,
  generateIcs,
  getGoogleCalendarUrl,
  type ExtractedEvent,
} from "@/lib/events";

export type FeedItem = {
  id: string;
  item_id?: string;
  subject: string;
  from_address?: string;
  received_at?: string;
  score: number;
  summary?: string;
  body?: string;
  links?: string[] | string;
  tags?: string[];
  is_personal?: boolean;
  status?: "new" | "kept" | "removed" | "done";
  venue?: string | null;
  source?: string | null;
  is_verified?: boolean;
  deadline_at?: string | null;
  /** Set by the sections builder. */
  section?: "action" | "courses" | "events" | "opportunities" | "campus";
  when?: string | null;
  myCourse?: string | null;
  /** Your seat, when a seating plan mentions your roll number. */
  seat?: string | null;
};

const STUB: Record<string, { code: string; whenLabel: string }> = {
  action: { code: "ACT", whenLabel: "Due" },
  courses: { code: "CRS", whenLabel: "When" },
  events: { code: "EVT", whenLabel: "Starts" },
  opportunities: { code: "OPP", whenLabel: "Posted" },
  campus: { code: "CMP", whenLabel: "Posted" },
};

function formatHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u.slice(0, 30);
  }
}

function formatDate(isoDate?: string | null): string {
  if (!isoDate) return "";
  try {
    return new Date(isoDate).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return isoDate;
  }
}

/** "TODAY 17:00" / "FRI 23:59" / "21 OCT" — board style. */
function stubWhen(iso?: string | null): { text: string; hot: boolean } {
  if (!iso) return { text: "—", hot: false };
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  const diffDays = Math.round((new Date(day(d)).getTime() - new Date(day(new Date())).getTime()) / 86400000);
  if (diffDays === 0) return { text: `TODAY ${time}`, hot: true };
  if (diffDays === 1) return { text: `TMRW ${time}`, hot: true };
  if (diffDays > 1 && diffDays < 7)
    return { text: `${d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).toUpperCase()} ${time}`, hot: false };
  return {
    text: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).toUpperCase(),
    hot: false,
  };
}

export function ItemCard({
  item,
  onStatusChange,
}: {
  item: FeedItem;
  onStatusChange?: (id: string, status: "kept" | "removed" | "new" | "done") => void;
}) {
  const [showBody, setShowBody] = useState(false);
  const [status, setStatus] = useState<"new" | "kept" | "removed" | "done">(item.status || "new");
  const [addingToTimetable, setAddingToTimetable] = useState(false);
  const [timetableAdded, setTimetableAdded] = useState(false);
  const [muted, setMuted] = useState(false);

  const itemId = item.id || item.item_id || "";
  // One unusual notice must never break the whole feed.
  let event: ExtractedEvent | null = null;
  try {
    event = extractEventDetails(item.subject, item.body || item.summary || "");
  } catch {
    event = null;
  }

  async function logInteraction(action: "view" | "add_to_calendar" | "dismiss" | "keep" | "dislike") {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && itemId) {
        await supabase.from("notice_interactions").insert({ user_id: user.id, notice_id: itemId, action });
      }
    } catch {
      // Telemetry errors should never degrade UI experience
    }
  }

  async function updateItemStatus(newStatus: "new" | "kept" | "removed" | "done") {
    setStatus(newStatus);
    onStatusChange?.(itemId, newStatus);
    if (newStatus === "kept") logInteraction("keep");
    else if (newStatus === "removed") logInteraction("dismiss");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email && itemId) {
        // Live schema: user_items(email, item_id, score, state); RLS allows updating own rows.
        await supabase
          .from("user_items")
          .update({ state: newStatus, updated_at: new Date().toISOString() })
          .eq("email", user.email.toLowerCase())
          .eq("item_id", itemId);
      }
    } catch {
      // Ignore background interaction errors
    }
  }

  /** "Not interested": hide everything from this sender from now on. */
  async function muteSender() {
    if (!item.from_address) return;
    setMuted(true);
    logInteraction("dislike");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data } = await supabase.from("subscribers").select("muted_senders").eq("email", user.email.toLowerCase()).maybeSingle();
      const list = Array.from(new Set([...(data?.muted_senders || []), item.from_address]));
      await supabase.from("subscribers").update({ muted_senders: list }).eq("email", user.email.toLowerCase());
    } catch {
      // ignore
    }
  }

  async function handleAddToTimetable(ev: ExtractedEvent) {
    setAddingToTimetable(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("Please sign in to add to your timetable.");
        return;
      }
      const { error } = await supabase.from("user_schedules").insert({
        user_id: user.id,
        notice_id: itemId ? itemId : null,
        title: ev.title,
        location: ev.location || "IIT Bombay",
        start_time: ev.start_time,
        end_time: ev.end_time,
        slot_type: ev.slot_type,
        is_cancelled: ev.is_cancelled || false,
      });
      if (error) alert(`Error adding to timetable: ${error.message}`);
      else {
        setTimetableAdded(true);
        logInteraction("add_to_calendar");
      }
    } catch (err: any) {
      alert(`Could not add to timetable: ${err.message}`);
    } finally {
      setAddingToTimetable(false);
    }
  }

  function handleDownloadIcs(ev: ExtractedEvent) {
    const icsContent = generateIcs({
      title: ev.title,
      description: item.summary || item.subject,
      location: ev.location,
      start_time: ev.start_time,
      end_time: ev.end_time,
    });
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${ev.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logInteraction("add_to_calendar");
  }

  if (muted) {
    return (
      <div className="card removed">
        <span>Hidden. You won&apos;t see notices from {item.from_address} again.</span>
      </div>
    );
  }
  if (status === "removed" || status === "done") {
    return (
      <div className="card removed">
        <span>{status === "done" ? "✓ Marked done" : "Hidden from your board"}</span>
        <button onClick={() => updateItemStatus("new")} className="link">
          Undo
        </button>
      </div>
    );
  }

  let linksArray: string[] = [];
  if (Array.isArray(item.links)) linksArray = item.links;
  else if (typeof item.links === "string") {
    try {
      linksArray = JSON.parse(item.links);
    } catch {
      linksArray = [item.links];
    }
  }

  const sec = item.section || "campus";
  const stub = STUB[sec];
  const when = stubWhen(item.when || (sec === "opportunities" || sec === "campus" ? item.received_at : null));

  return (
    <article className={`ticket sec-${sec} ${status === "kept" ? "kept" : ""}`}>
      <div className="stub">
        <span className="sec">{item.myCourse ? item.myCourse.replace(" ", "") : stub.code}</span>
        <span className="when-k">{stub.whenLabel}</span>
        <span className={`when-v ${when.hot ? "hot" : ""}`}>{when.text}</span>
        {item.seat && (
          <>
            <span className="when-k">Your seat</span>
            <span className="when-v hot">{item.seat}</span>
          </>
        )}
      </div>

      <div className="ticket-main">
        <div className="meta">
          {item.is_verified && <span className="tag verified">✓ Instructor</span>}
          {item.source === "whatsapp" && <span className="tag wa">WhatsApp</span>}
          {item.source === "moodle" && <span className="tag personal">Moodle</span>}
          {item.score >= 8 && <span className="tag high">Priority</span>}
          {event?.is_cancelled && <span className="tag event high">Class cancelled</span>}
          {item.from_address && <span className="from">{item.from_address}</span>}
          {item.received_at && <span className="from">{formatDate(item.received_at)}</span>}
        </div>

        <h3>{item.subject}</h3>
        {item.summary && <p className="summary">{item.summary}</p>}

        {event && (
          <div className="event-banner">
            <div>
              <strong>{event.title}</strong>
              {event.location && <span> · {event.location}</span>}
              <span> · {formatDate(event.start_time)}</span>
            </div>
            <div className="actions" style={{ marginTop: 8 }}>
              <button onClick={() => handleAddToTimetable(event)} disabled={addingToTimetable || timetableAdded}>
                {timetableAdded ? "✓ On your week" : addingToTimetable ? "Adding…" : "+ Add to week"}
              </button>
              <button onClick={() => handleDownloadIcs(event)} title="Download .ics for Apple/Outlook/Google Calendar">
                .ics
              </button>
              <a
                href={getGoogleCalendarUrl({
                  title: event.title,
                  description: item.summary || item.subject,
                  location: event.location,
                  start_time: event.start_time,
                  end_time: event.end_time,
                })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logInteraction("add_to_calendar")}
                className="small mono"
              >
                Google Cal ↗
              </a>
            </div>
          </div>
        )}

        {linksArray.length > 0 && (
          <div className="links" style={{ marginTop: 8 }}>
            {linksArray.map((l, idx) => (
              <a key={idx} href={l} target="_blank" rel="noopener noreferrer">
                {formatHost(l)} ↗
              </a>
            ))}
          </div>
        )}

        {item.body && (
          <>
            <button onClick={() => setShowBody(!showBody)} className="link small" style={{ marginTop: 6 }}>
              {showBody ? "Hide full notice" : "Read full notice"}
            </button>
            {showBody && <div className="body">{item.body}</div>}
          </>
        )}

        <div className="actions ticket-actions">
          {sec === "action" && (
            <button className="accent" style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => updateItemStatus("done")}>
              ✓ Done
            </button>
          )}
          <button onClick={() => updateItemStatus(status === "kept" ? "new" : "kept")}>
            {status === "kept" ? "★ Saved" : "☆ Save"}
          </button>
          <button className="ghost" onClick={() => updateItemStatus("removed")}>
            Hide
          </button>
          {item.from_address && (
            <button className="link" onClick={muteSender} style={{ marginLeft: "auto" }}>
              Not interested in this sender
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
