"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Conn = { moodle_fullname: string | null; connected_at: string; last_sync_at: string | null; last_error: string | null };

const KEYS_URL = "https://moodle.iitb.ac.in/user/managetoken.php";
// Opening this once (after IIT Bombay SSO) creates the "Moodle mobile web service" key if you don't have one.
const CREATE_URL = "https://moodle.iitb.ac.in/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=campusdaily&urlscheme=moodlemobile";

export function MoodleConnect() {
  const [conn, setConn] = useState<Conn | null | undefined>(undefined);
  const [key, setKey] = useState("");
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
      body: JSON.stringify({ key }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setKey("");
      setMsg({ ok: true, text: `Connected as ${j.name}. Your courses will be read within 30 minutes.` });
      load();
    } else setMsg({ ok: false, text: j.error || "Could not connect." });
  }

  async function disconnect() {
    await createClient().from("moodle_connections").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
    setConn(null);
    setMsg({ ok: true, text: "Disconnected. Campus Daily no longer reads your Moodle. (You can also Reset the key on Moodle.)" });
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
              {conn.last_error ? ` · Problem: ${conn.last_error}` : ""}
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
      <ol className="steps">
        <li>
          Open your{" "}
          <a href={KEYS_URL} target="_blank" rel="noopener noreferrer">
            Moodle security keys
          </a>{" "}
          (sign in with IIT Bombay SSO if asked).
        </li>
        <li>
          Copy the <b>Key</b> next to <b>Moodle mobile web service</b>.
          <span className="help">
            {" "}
            Not listed? Open{" "}
            <a href={CREATE_URL} target="_blank" rel="noopener noreferrer">
              this link once
            </a>{" "}
            (ignore any &quot;open app&quot; message), then refresh the security keys page.
          </span>
        </li>
        <li>Paste it here:</li>
      </ol>
      <label className="field">
        Moodle key
        <input
          value={key}
          onChange={(e) => setKey(e.target.value.trim())}
          placeholder="32 letters and numbers"
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <p className="help" style={{ marginTop: 8 }}>
        No password ever reaches Campus Daily. The key is stored encrypted and lets us read your courses like the Moodle app does.
        Announcements and files are shared with classmates in the same course; your seat stays private. Disconnect any time.
      </p>
      <button type="button" className="primary" onClick={connect} disabled={busy || key.length < 32} style={{ marginTop: 10 }}>
        {busy ? "Checking key…" : "Connect Moodle"}
      </button>
      {msg && <p className={msg.ok ? "note" : "err"}>{msg.text}</p>}
    </div>
  );
}
