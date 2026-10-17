"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  extractEventDetails,
  generateIcs,
  getGoogleCalendarUrl,
  type ExtractedEvent,
} from "@/lib/events";
import { cleanSubject, senderName, sourceLabel } from "@/lib/display";
import type { Linked } from "@/lib/linking";
import {
  ArrowUpRight,
  BellOff,
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  EyeOff,
  GraduationCap,
  Mail,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react";

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
  section?: "action" | "exams" | "courses" | "events" | "opportunities" | "campus";
  when?: string | null;
  myCourse?: string | null;
  /** Your seat, when a seating plan mentions your roll number. */
  seat?: string | null;
  /** Set when several sources reported the same event (see lib/linking). */
  linked?: Linked;
};

const SOURCE_NAME: Record<string, string> = { moodle: "Moodle", email: "Email", whatsapp: "WhatsApp", bodhitree: "Bodhitree" };

/** "Moodle · Email · WhatsApp ×2" */
function sourcesLine(l: Linked): string {
  const counts = new Map<string, number>();
  for (const s of l.sources) counts.set(s.source, (counts.get(s.source) || 0) + 1);
  return [...counts.entries()].map(([k, n]) => `${SOURCE_NAME[k] || k}${n > 1 ? ` ×${n}` : ""}`).join(" · ");
}

const shortTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function formatHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u.slice(0, 30);
  }
}

/** "2h ago" / "Yesterday" / "12 Oct" */
function ago(iso?: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  if (mins < 48 * 60) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
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

/** "today 17:00" / "tomorrow 23:59" / "Fri 17:15" / "23 Oct" */
function friendlyWhen(iso: string): { text: string; hot: boolean } {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  const diffDays = Math.round((new Date(day(d)).getTime() - new Date(day(new Date())).getTime()) / 86400000);
  if (diffDays === 0) return { text: "today " + time, hot: true };
  if (diffDays === 1) return { text: "tomorrow " + time, hot: true };
  if (diffDays > 1 && diffDays < 7) return { text: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }) + " " + time, hot: false };
  return { text: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }), hot: false };
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
      // Already in the timetable? Don't add it twice.
      const { data: existing } = await supabase
        .from("user_schedules")
        .select("id")
        .eq("title", ev.title)
        .eq("start_time", ev.start_time)
        .limit(1);
      if (existing && existing.length > 0) {
        setTimetableAdded(true);
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
        <span>Hidden. You won&apos;t see notices from {senderName(item.from_address)} again.</span>
      </div>
    );
  }
  if (status === "removed" || status === "done") {
    return (
      <div className="card removed">
        <span>{status === "done" ? "Marked done" : "Hidden from your board"}</span>
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
  const when = item.when && (sec === "action" || sec === "exams" || sec === "events" || sec === "courses") ? friendlyWhen(item.when) : null;
  const SrcIcon = item.source === "whatsapp" ? MessageCircle : item.source === "moodle" ? GraduationCap : Mail;

  return (
    <article className={`notice sec-${sec} ${status === "kept" ? "kept" : ""}`}>
      <div className="meta">
        <span className={`src src-${item.source || "mail"}`} title={item.from_address || ""}>
          <SrcIcon aria-hidden />
          {sourceLabel(item)}
        </span>
        {item.received_at && (
          <time className="from" dateTime={item.received_at} title={formatDate(item.received_at)}>
            {ago(item.received_at)}
          </time>
        )}
        {item.is_verified && <span className="tag verified">Instructor</span>}
        {item.score >= 8 && <span className="tag high">Priority</span>}
        {event?.is_cancelled && <span className="tag event high">Class cancelled</span>}
      </div>

      <h3 title={item.subject}>{cleanSubject(item.subject)}</h3>
      {item.summary && <p className="summary">{item.summary}</p>}

      {item.linked && item.linked.sources.length > 1 && (
        <div className="linked">
          <span className="linked-src">Reported on {sourcesLine(item.linked)}</span>
          {(item.linked.cancelled || item.linked.start || item.linked.venue) && (
            <span className="linked-now">
              {item.linked.cancelled
                ? "Latest: cancelled"
                : `Latest: ${[item.linked.start ? shortTime(item.linked.start) : "", item.linked.venue || ""].filter(Boolean).join(", ")}`}
            </span>
          )}
          {item.linked.conflicts.slice(0, 2).map((c, i) => (
            <span key={i} className="linked-conflict">
              {SOURCE_NAME[c.source] || c.source} said {c.field === "start" ? shortTime(c.value) : c.value} ({ago(c.at)})
            </span>
          ))}
        </div>
      )}

      {(when || item.seat) && (
        <div className="actions" style={{ marginTop: 10 }}>
          {when && (
            <span className={`when-chip ${when.hot ? "hot" : ""}`}>
              <Clock aria-hidden />
              {sec === "action" ? "Due " : ""}
              {when.text}
            </span>
          )}
          {item.seat && <span className="when-chip seat">Seat {item.seat}</span>}
        </div>
      )}

      {event && sec !== "action" && sec !== "opportunities" && sec !== "campus" && (
        <div className="event-banner">
          <div>
            <strong>{cleanSubject(event.title)}</strong>
            {event.location && <span> · {event.location}</span>}
            <span> · {formatDate(event.start_time)}</span>
          </div>
          <div className="actions">
            <button onClick={() => handleAddToTimetable(event)} disabled={addingToTimetable || timetableAdded}>
              {timetableAdded ? <Check aria-hidden /> : <CalendarPlus aria-hidden />}
              {timetableAdded ? "In your timetable" : addingToTimetable ? "Adding…" : "Add to timetable"}
            </button>
            <button className="ghost" onClick={() => handleDownloadIcs(event)} title="Download for Apple / Outlook calendar">
              <Download aria-hidden />
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
              className="btn-link"
            >
              Google Calendar
              <ArrowUpRight aria-hidden />
            </a>
          </div>
        </div>
      )}

      {linksArray.length > 0 && (
        <div className="links">
          {linksArray.map((l, idx) => (
            <a key={idx} href={l} target="_blank" rel="noopener noreferrer">
              {formatHost(l)}
              <ArrowUpRight aria-hidden />
            </a>
          ))}
        </div>
      )}

      {showBody && item.body && <div className="body">{item.body}</div>}

      <div className="actions ticket-actions">
        {sec === "action" && (
          <button className="accent" onClick={() => updateItemStatus("done")}>
            <Check aria-hidden />
            Done
          </button>
        )}
        {item.body && (
          <button className="ghost" onClick={() => setShowBody(!showBody)} aria-expanded={showBody}>
            {showBody ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
            {showBody ? "Less" : "Full notice"}
          </button>
        )}
        <span className="spacer" />
        <button
          className={`ghost ${status === "kept" ? "on" : ""}`}
          onClick={() => updateItemStatus(status === "kept" ? "new" : "kept")}
          aria-pressed={status === "kept"}
        >
          {status === "kept" ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
          {status === "kept" ? "Saved" : "Save"}
        </button>
        <details className="more">
          <summary aria-label="More options">
            <MoreHorizontal aria-hidden width={18} height={18} />
          </summary>
          <div className="more-menu">
            <button onClick={() => updateItemStatus("removed")}>
              <EyeOff aria-hidden />
              Hide this notice
            </button>
            {item.from_address && (
              <button onClick={muteSender}>
                <BellOff aria-hidden />
                Stop showing {senderName(item.from_address) || "this sender"}
              </button>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}
