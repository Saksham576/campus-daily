"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ExtensionUpdate } from "@/components/ExtensionUpdate";

type Conn = { moodle_fullname: string | null; connected_at: string; last_sync_at: string | null; last_error: string | null };

/**
 * IITB Moodle signs in only through IIT Bombay SSO in a real browser, and students can't see
 * Moodle's "Security keys" page. The Campus Daily Connect extension catches the key Moodle hands
 * its own app after SSO; the PC helper is the fallback.
 */
export function MoodleConnect() {
  const [conn, setConn] = useState<Conn | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasExt, setHasExt] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const { data } = await createClient()
      .from("moodle_connections")
      .select("moodle_fullname, connected_at, last_sync_at, last_error")
      .maybeSingle();
    setConn((data as Conn) || null);
    return data;
  }

  useEffect(() => {
    load();
    // Detect the extension: it marks <html> and also answers a ping (the mark can be lost while the page loads).
    const seen = () => setHasExt(true);
    if (document.documentElement.dataset.cdConnect) seen();
    const onMsg = (e: MessageEvent) => {
      if (e.source === window && e.data?.type === "cd-connect-pong") seen();
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ type: "cd-connect-ping" }, window.location.origin);
    const recheck = setTimeout(() => {
      if (document.documentElement.dataset.cdConnect) seen();
      window.postMessage({ type: "cd-connect-ping" }, window.location.origin);
    }, 1200);
    const m = new URLSearchParams(window.location.search).get("moodle");
    if (m) setMsg(m);
    return () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(recheck);
      if (poll.current) clearInterval(poll.current);
    };
  }, []);

  async function connect() {
    setMsg(null);
    const res = await fetch("/api/moodle/connect-start", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.url) return setMsg(j.error || "Couldn't start. Try again.");
    window.open(j.url, "_blank", "noopener");
    setWaiting(true);
    let tries = 0;
    poll.current = setInterval(async () => {
      tries++;
      const d = await load();
      if (d || tries > 100) {
        if (poll.current) clearInterval(poll.current);
        setWaiting(false);
      } else if (tries === 40) {
        setMsg(
          "Still waiting. Finish the IITB sign-in in the Moodle tab. If you already did and nothing happened, open chrome://extensions, check that Campus Daily Connect is switched on (version 1.1.0 or newer), then try again."
        );
      }
    }, 3000);
  }

  async function disconnect() {
    await createClient().from("moodle_connections").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
    setConn(null);
    setMsg("Disconnected. Campus Daily no longer reads your Moodle.");
  }

  if (conn === undefined) return <p className="help">Checking…</p>;

  if (conn) {
    return (
      <div>
        <div className="list-row">
          <span>
            <b>Connected</b> as {conn.moodle_fullname}
            <br />
            <span className="help">
              {conn.last_sync_at
                ? `Last read ${new Date(conn.last_sync_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
                : "First read within 30 minutes."}
              {conn.last_error ? ` · Problem: ${conn.last_error}` : ""}
            </span>
          </span>
          <button type="button" onClick={disconnect}>
            Disconnect
          </button>
        </div>
        <ExtensionUpdate />
        {msg && <p className="note">{msg}</p>}
      </div>
    );
  }

  return (
    <div>
      {hasExt ? (
        <>
          <p className="help" style={{ marginBottom: 10 }}>
            Moodle opens in a new tab. Sign in with IIT Bombay SSO as usual — the tab comes back here when it&apos;s done.
          </p>
          <button type="button" className="primary" onClick={connect} disabled={waiting}>
            {waiting ? "Waiting for Moodle sign-in…" : "Connect Moodle"}
          </button>
          <ExtensionUpdate />
        </>
      ) : (
        <>
          <p className="help" style={{ marginBottom: 8 }}>
            IIT Bombay Moodle only lets apps sign in through the IITB SSO page, so connecting needs the small Campus Daily Connect
            extension (Chrome, Edge or Brave on a laptop — about a minute, once):
          </p>
          <ol className="steps">
            <li>
              <a href="/campus-daily-connect.zip" download>
                Download the extension
              </a>{" "}
              and unzip it.
            </li>
            <li>
              Open <code>chrome://extensions</code>, switch on <b>Developer mode</b> (top right), click <b>Load unpacked</b> and pick the
              unzipped folder (the one with <code>manifest.json</code> inside).
            </li>
            <li>Reload this page — a one-click Connect Moodle button appears here.</li>
          </ol>
          <p className="help" style={{ marginTop: 8 }}>
            The extension only watches Moodle&apos;s app-login page. Your password stays on IITB&apos;s sign-in page.
          </p>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={connect} disabled={waiting}>
              {waiting ? "Waiting for Moodle sign-in…" : "Installed it? Connect Moodle"}
            </button>
          </div>
        </>
      )}
      {msg && <p className="note">{msg}</p>}
    </div>
  );
}
