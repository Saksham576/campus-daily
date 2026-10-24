"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/Sheet";
import { toast } from "@/components/Toaster";
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
  Instagram,
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
  hint,
}: {
  item: FeedItem;
  /** First card in the list: teach the swipe gesture once, on touch screens. */
  hint?: boolean;
  onStatusChange?: (id: string, status: "kept" | "removed" | "new" | "done") => void;
}) {
  const [showBody, setShowBody] = useState(false);
  const [status, setStatus] = useState<"new" | "kept" | "removed" | "done">(item.status || "new");
  const [addingToTimetable, setAddingToTimetable] = useState(false);
  const [timetableAdded, setTimetableAdded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [detail, setDetail] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [coach, setCoach] = useState(false);
  const [demoDx, setDemoDx] = useState(0);
  const stopCoach = () => {
    setCoach(false);
    setDemoDx(0);
    try {
      localStorage.setItem("cd_swipe_seen", "1");
    } catch {}
  };
  // Once per device: when the first notice scrolls into view on a phone, nudge it right then left.
  useEffect(() => {
    if (!hint) return;
    try {
      if (localStorage.getItem("cd_swipe_seen") || !matchMedia("(pointer: coarse)").matches) return;
    } catch {
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setCoach(true);
        if (!reduce) for (const [t, v] of [[500, 72], [1500, 0], [1900, -72], [2900, 0]]) timers.push(setTimeout(() => setDemoDx(v), t));
        timers.push(setTimeout(stopCoach, 5600));
      },
      { threshold: 0.7 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint]);
  // Phone swipe: right = Done, left = Save.
  const [drag, setDrag] = useState<{ x0: number; y0: number; dx: number; live: boolean } | null>(null);

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
    if (newStatus === "done") toast("Marked done", () => updateItemStatus("new"));
    else if (newStatus === "removed") toast("Notice hidden", () => updateItemStatus("new"));
    else if (newStatus === "kept") toast("Saved", () => updateItemStatus("new"));
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
    toast(`Fewer notices from ${senderName(item.from_address) || "this sender"}`, unmuteSender);
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

  /** Undo "Not interested". */
  async function unmuteSender() {
    setMuted(false);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email || !item.from_address) return;
      const { data } = await supabase.from("subscribers").select("muted_senders").eq("email", user.email.toLowerCase()).maybeSingle();
      await supabase
        .from("subscribers")
        .update({ muted_senders: (data?.muted_senders || []).filter((s: string) => s !== item.from_address) })
        .eq("email", user.email.toLowerCase());
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

  // Reversible actions leave the feed at once; the shared toast carries the Undo.
  if (muted || status === "removed" || status === "done") return null;

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
  const isInstagram = item.source === "instagram" || (item.from_address || "").startsWith("Instagram:");
  const SrcIcon = item.source === "whatsapp" ? MessageCircle : item.source === "moodle" ? GraduationCap : isInstagram ? Instagram : Mail;
  const srcClass = isInstagram ? "instagram" : item.source || "mail";

  const dx = drag?.live ? drag.dx : demoDx;
  const onTouchStart = (e: React.TouchEvent) => {
    if (coach) stopCoach();
    setDrag({ x0: e.touches[0].clientX, y0: e.touches[0].clientY, dx: 0, live: false });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag) return;
    const mx = e.touches[0].clientX - drag.x0;
    const my = e.touches[0].clientY - drag.y0;
    if (!drag.live && (Math.abs(mx) < 12 || Math.abs(mx) < Math.abs(my) * 1.5)) return;
    setDrag({ ...drag, dx: Math.max(-140, Math.min(140, mx)), live: true });
  };
  const onTouchEnd = () => {
    if (drag?.live) {
      if (drag.dx > 90) updateItemStatus("done");
      else if (drag.dx < -90 && status !== "kept") updateItemStatus("kept");
    }
    setDrag(null);
  };

  return (
    <div className="swipe-wrap" ref={wrapRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={() => setDrag(null)}>
      {dx > 0 && <span className="swipe-hint done" aria-hidden>Done</span>}
      {dx < 0 && <span className="swipe-hint save" aria-hidden>Save</span>}
    <article
      className={`notice sec-${sec} ${status === "kept" ? "kept" : ""} ${coach ? "demo" : ""}`}
      style={dx ? { transform: `translateX(${dx}px)` } : undefined}
    >
      <div className="meta">
        <span className={`src src-${srcClass}`} title={item.from_address || ""}>
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

      <button type="button" className="notice-open" onClick={() => setDetail(true)} aria-label={`Open: ${cleanSubject(item.subject)}`}>
        <h3 title={item.subject}>{cleanSubject(item.subject)}</h3>
        {item.summary && <p className="summary">{item.summary}</p>}
      </button>

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

      <div className="actions ticket-actions">
        {sec === "action" && (
          <button data-act="done" className={when?.hot ? "accent" : "ghost"} onClick={() => updateItemStatus("done")}>
            <Check aria-hidden />
            Done
          </button>
        )}
        {item.body && (
          <button className="ghost" onClick={() => setDetail(true)}>
            <ChevronDown aria-hidden />
            Full notice
          </button>
        )}
        <span className="spacer" />
        <button
          data-act="save"
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
                Not interested in {senderName(item.from_address) || "this sender"}
              </button>
            )}
          </div>
        </details>
      </div>
    </article>
    {coach && (
      <div className="coach" role="note">
        <span>Swipe right: Done</span>
        <span aria-hidden>·</span>
        <span>Swipe left: Save</span>
      </div>
    )}
    {detail && (
      <Sheet title={cleanSubject(item.subject)} onClose={() => setDetail(false)}>
        <p className="eyebrow">
          {sourceLabel(item)}
          {item.received_at ? ` · ${formatDate(item.received_at)}` : ""}
        </p>
        <h2 className="sheet-title">{cleanSubject(item.subject)}</h2>
        {(when || item.seat) && (
          <div className="actions" style={{ marginBottom: 8 }}>
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
        <div className="sheet-body">{item.body || item.summary}</div>
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
        {event && (
          <div className="sheet-actions" style={{ marginTop: 14 }}>
            <button onClick={() => handleAddToTimetable(event)} disabled={addingToTimetable || timetableAdded}>
              {timetableAdded ? <Check aria-hidden /> : <CalendarPlus aria-hidden />}
              {timetableAdded ? "In your timetable" : "Add to timetable"}
            </button>
            <button className="ghost" onClick={() => handleDownloadIcs(event)}>
              <Download aria-hidden />
              .ics
            </button>
          </div>
        )}
        <div className="sheet-actions" style={{ marginTop: 10 }}>
          <button
            onClick={() => {
              setDetail(false);
              updateItemStatus("done");
            }}
          >
            <Check aria-hidden />
            Done
          </button>
          <button className="ghost" onClick={() => updateItemStatus(status === "kept" ? "new" : "kept")}>
            {status === "kept" ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
            {status === "kept" ? "Saved" : "Save"}
          </button>
        </div>
      </Sheet>
    )}
    </div>
  );
}
