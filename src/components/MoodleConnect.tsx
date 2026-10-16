"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Conn = { moodle_fullname: string | null; connected_at: string; last_sync_at: string | null; last_error: string | null };

/**
 * IITB Moodle signs in only through IIT Bombay SSO in a real browser, and students can't see
 * Moodle's "Security keys" page. So connecting is done by the small Campus Daily PC helper,
 * which opens Moodle's own app-login page, lets you sign in with SSO, and saves the app key.
 */
export function MoodleConnect() {
  const [conn, setConn] = useState<Conn | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data } = await createClient()
      .from("moodle_connections")
      .select("moodle_fullname, connected_at, last_sync_at, last_error")
      .maybeSingle();
    setConn((data as Conn) || null);
  }
  useEffect(() => {
    load();
  }, []);

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
      </div>
    );
  }

  return (
    <div>
      <p className="help" style={{ marginBottom: 8 }}>
        IIT Bombay Moodle only lets apps sign in through the IITB SSO page, so connecting happens on a computer with the Campus Daily helper:
      </p>
      <ol className="steps">
        <li>
          On the PC with Campus Daily&apos;s helper, open the <b>whatsapp-bridge</b> folder and double-click <b>Connect Moodle</b>.
        </li>
        <li>A Moodle window opens — sign in with IIT Bombay SSO as usual.</li>
        <li>The window closes by itself and this page shows &quot;Connected&quot;.</li>
      </ol>
      <button
        type="button"
        style={{ marginTop: 12 }}
        onClick={async () => {
          setMsg("Checking…");
          await load();
          setMsg("Not connected yet. Run Connect Moodle on the PC, sign in, wait for the window to close, then check again.");
        }}
      >
        I&apos;ve done it — check again
      </button>
      {msg && <p className="note">{msg}</p>}
    </div>
  );
}
