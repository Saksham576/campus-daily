"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarSync, ExternalLink, Upload } from "lucide-react";

export type Feed = { host: string; last_sync_at: string | null; last_count: number | null; last_error: string | null; slot_type: string } | null;

const KINDS = [
  { v: "event", label: "Events" },
  { v: "lecture", label: "Classes" },
  { v: "custom", label: "Other" },
];

/** Bring a Google Calendar (or Outlook / iCloud) into the timetable: its secret address (stays in sync) or an exported .ics file. */
export function CalendarImport({ feed, onDone, onClose }: { feed: Feed; onDone: (note: string) => void; onClose: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("event");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function call(body: Record<string, unknown>, ok: (r: { imported: number; skipped: number }) => string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/timetable/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.error || "Couldn't import that calendar.");
      onDone(ok(j));
      setUrl("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't import that calendar.");
    } finally {
      setBusy(false);
    }
  }

  const summary = (r: { imported: number; skipped: number }) =>
    `Imported ${r.imported} event${r.imported === 1 ? "" : "s"}.${r.skipped ? ` ${r.skipped} skipped (all-day or already in your timetable).` : ""}`;

  async function pickFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 5_000_000) return setError("That file is too big (5 MB max).");
    const text = await f.text();
    await call({ ics: text, kind }, summary);
    if (file.current) file.current.value = "";
  }

  async function disconnect() {
    if (!confirm("Disconnect this calendar and remove the events it added?")) return;
    setBusy(true);
    await fetch("/api/timetable/import", { method: "DELETE" }).catch(() => {});
    setBusy(false);
    onDone("Calendar disconnected.");
    router.refresh();
  }

  return (
    <section className="panel pform" style={{ marginBottom: 20 }} aria-label="Import a calendar">
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <h2 className="panel-title">Import from Google Calendar</h2>
      </div>

      {feed && (
        <div className="note" style={{ margin: 0 }}>
          <b>Connected</b> to {feed.host}
          {feed.last_sync_at ? ` · updated ${new Date(feed.last_sync_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}` : ""}
          {feed.last_count !== null ? ` · ${feed.last_count} events` : ""}. It refreshes by itself every few hours.
          {feed.last_error && <span className="err"> Last problem: {feed.last_error}</span>}
          <div className="actions" style={{ marginTop: 8 }}>
            <button type="button" onClick={() => call({ sync: true }, summary)} disabled={busy}>
              <CalendarSync aria-hidden /> Refresh now
            </button>
            <button type="button" className="ghost" onClick={disconnect} disabled={busy}>
              Disconnect
            </button>
          </div>
        </div>
      )}

      <div className="field">
        <span>Bring them in as</span>
        <div className="chips" role="radiogroup" aria-label="Bring them in as">
          {KINDS.map((k) => (
            <button key={k.v} type="button" role="radio" aria-checked={kind === k.v} className={`chip ${kind === k.v ? "on" : ""}`} onClick={() => setKind(k.v)}>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="cal-url">Option 1: connect it (stays up to date)</label>
        <input id="cal-url" type="url" inputMode="url" placeholder="Paste the secret address in iCal format (ends in .ics)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <ol className="help cal-steps">
          <li>
            Open{" "}
            <a href="https://calendar.google.com/calendar/u/0/r/settings" target="_blank" rel="noopener noreferrer">
              Google Calendar settings <ExternalLink aria-hidden width={12} height={12} />
            </a>{" "}
            on a laptop.
          </li>
          <li>Under “Settings for my calendars”, click the calendar you want.</li>
          <li>Scroll to “Integrate calendar” and copy “Secret address in iCal format”.</li>
          <li>Paste it above and press Import. Anyone with that address can read the calendar, so don&apos;t share it.</li>
        </ol>
        <div className="actions">
          <button type="button" className="primary" disabled={busy || url.trim().length < 10} onClick={() => call({ url, kind }, summary)}>
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </div>

      <div className="field">
        <span>Option 2: upload a file</span>
        <p className="help">In Google Calendar settings choose “Import &amp; export” → Export, unzip it, and pick the .ics file of the calendar you want. This is a one-time copy.</p>
        <input ref={file} type="file" accept=".ics,text/calendar" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
        <div className="actions">
          <button type="button" disabled={busy} onClick={() => file.current?.click()}>
            <Upload aria-hidden /> Choose .ics file
          </button>
        </div>
      </div>

      {error && <p className="err">{error}</p>}
      <div className="actions">
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
