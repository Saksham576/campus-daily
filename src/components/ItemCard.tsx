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
  status?: "new" | "kept" | "removed";
  venue?: string | null;
  source?: string | null;
  is_verified?: boolean;
};

function formatHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u.slice(0, 30);
  }
}

function formatDate(isoDate?: string): string {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    return d.toLocaleString("en-IN", {
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

export function ItemCard({
  item,
  onStatusChange,
}: {
  item: FeedItem;
  onStatusChange?: (id: string, status: "kept" | "removed" | "new") => void;
}) {
  const [showBody, setShowBody] = useState(false);
  const [status, setStatus] = useState<"new" | "kept" | "removed">(
    item.status || "new"
  );
  const [addingToTimetable, setAddingToTimetable] = useState(false);
  const [timetableAdded, setTimetableAdded] = useState(false);

  const itemId = item.id || item.item_id || "";
  const event = extractEventDetails(item.subject, item.body || item.summary || "");

  // Silently logs notice interactions for Phase 2 ML relevance feedback
  async function logInteraction(action: "view" | "add_to_calendar" | "dismiss" | "keep" | "dislike") {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && itemId) {
        await supabase.from("notice_interactions").insert({
          user_id: user.id,
          notice_id: itemId,
          action,
        });
      }
    } catch {
      // Telemetry errors should never degrade UI experience
    }
  }

  async function updateItemStatus(newStatus: "new" | "kept" | "removed") {
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

      // Foreign key requires null instead of empty string if notice_id is unassigned
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

      if (error) {
        alert(`Error adding to timetable: ${error.message}`);
      } else {
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
    link.setAttribute(
      "download",
      `${ev.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logInteraction("add_to_calendar");
  }

  if (status === "removed") {
    return (
      <div className="card removed">
        <span>Notice hidden from your feed.</span>
        <button
          onClick={() => updateItemStatus("new")}
          className="link"
        >
          Undo
        </button>
      </div>
    );
  }

  // Parse links
  let linksArray: string[] = [];
  if (Array.isArray(item.links)) {
    linksArray = item.links;
  } else if (typeof item.links === "string") {
    try {
      linksArray = JSON.parse(item.links);
    } catch {
      linksArray = [item.links];
    }
  }

  return (
    <article className={`card ${status === "kept" ? "kept" : ""}`}>
      <div className="meta">
        {item.is_verified && (
          <span className="tag" style={{ borderColor: "#B8860B", color: "#B8860B" }}>✓ Verified Instructor</span>
        )}
        {item.source === "whatsapp" && <span className="tag">WhatsApp</span>}
        {item.score >= 8 && <span className="tag high">Top Notice ★</span>}
        {item.is_personal && <span className="tag personal">Direct / Action Req</span>}
        {event && (
          <span className={`tag event ${event.is_cancelled ? "high" : ""}`}>
            {event.is_cancelled ? "⚠ Class Cancelled" : `📅 ${event.slot_type.toUpperCase()}`}
          </span>
        )}
        {item.from_address && <span className="from">{item.from_address}</span>}
        {item.received_at && (
          <span className="muted">{formatDate(item.received_at)}</span>
        )}
      </div>

      <h3>{item.subject}</h3>

      {item.summary && <p className="muted">{item.summary}</p>}

      {/* Structured Event Banner & 1-Tap Actions */}
      {event && (
        <div className="event-banner">
          <div>
            <strong>{event.title}</strong>
            {event.location && <span> · 📍 {event.location}</span>}
            <span> · ⏰ {formatDate(event.start_time)}</span>
          </div>
          <div className="actions" style={{ marginTop: 4 }}>
            <button
              onClick={() => handleAddToTimetable(event)}
              disabled={addingToTimetable || timetableAdded}
              className="accent"
              style={{ padding: "4px 10px", fontSize: "12px" }}
            >
              {timetableAdded
                ? "✓ In Timetable"
                : addingToTimetable
                ? "Adding…"
                : "+ Add to Timetable"}
            </button>
            <button
              onClick={() => handleDownloadIcs(event)}
              style={{ padding: "4px 10px", fontSize: "12px" }}
              title="Download .ics for Apple/Outlook/Google Calendar"
            >
              📥 .ics
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
              className="navlink small"
              style={{ alignSelf: "center", textDecoration: "none" }}
            >
              Google Cal ↗
            </a>
          </div>
        </div>
      )}

      {linksArray.length > 0 && (
        <div className="links" style={{ marginTop: 8 }}>
          {linksArray.map((l, idx) => (
            <a
              key={idx}
              href={l}
              target="_blank"
              rel="noopener noreferrer"
              className="small"
            >
              {formatHost(l)} ↗
            </a>
          ))}
        </div>
      )}

      {item.body && (
        <>
          <div className="actions">
            <button
              onClick={() => setShowBody(!showBody)}
              className="link small"
            >
              {showBody ? "Hide notice text ▲" : "View full notice ▼"}
            </button>
          </div>
          {showBody && <div className="body">{item.body}</div>}
        </>
      )}

      <div className="actions" style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 12 }}>
        <button
          onClick={() =>
            updateItemStatus(status === "kept" ? "new" : "kept")
          }
          className="small"
        >
          {status === "kept" ? "✓ Saved" : "Save Notice"}
        </button>
        <button
          onClick={() => updateItemStatus("removed")}
          className="link small"
          style={{ color: "var(--muted)" }}
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}
