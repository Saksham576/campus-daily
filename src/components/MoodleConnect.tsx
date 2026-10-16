"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Conn = { moodle_fullname: string | null; connected_at: string; last_sync_at: string | null; last_error: string | null };

export function MoodleConnect() {
  const [conn, setConn] = useState<Conn | null | undefined>(undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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

  async function connect() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/moodle/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const j = await res.json().catch(() => ({}));
    setPassword("");
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: `Connected as ${j.name}. Your courses will be read within 30 minutes.` });
      load();
    } else setMsg({ ok: false, text: j.error || "Could not connect." });
  }

  async function disconnect() {
    await createClient().from("moodle_connections").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
    setConn(null);
    setMsg({ ok: true, text: "Disconnected. Campus Daily no longer reads your Moodle." });
  }

  if (conn === undefined) return <p className="help">Checking…</p>;

  if (conn) {
    return (
      <div>
        <div className="list-row">
          <span>
            <b>✓ Connected</b> as {conn.moodle_fullname}
            <br />
            <span className="help">
              {conn.last_sync_at
                ? `Last read ${new Date(conn.last_sync_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
                : "First read within 30 minutes."}
              {conn.last_error ? ` · Last problem: ${conn.last_error}` : ""}
            </span>
          </span>
          <button type="button" onClick={disconnect}>
            Disconnect
          </button>
        </div>
        {msg && <p className={msg.ok ? "note" : "err"}>{msg.text}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="row2">
        <label className="field">
          Moodle username
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your LDAP ID" autoComplete="username" />
        </label>
        <label className="field">
          Moodle password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
      </div>
      <p className="help" style={{ marginTop: 8 }}>
        Used once to get Moodle&apos;s app key (like logging in to the Moodle app). Your password is never stored. Course announcements and
        files are shared with classmates in the same course; your seat and anything personal stay private to you. Disconnect any time.
      </p>
      <button type="button" className="primary" onClick={connect} disabled={busy || !username || !password} style={{ marginTop: 10 }}>
        {busy ? "Connecting…" : "Connect Moodle"}
      </button>
      {msg && <p className={msg.ok ? "note" : "err"}>{msg.text}</p>}
    </div>
  );
}
