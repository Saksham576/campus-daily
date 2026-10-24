"use client";

import { useEffect, useState } from "react";
import { Instagram, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mine = { id: number; handle: string; last_fetched_at: string | null; last_filed: number | null; last_error: string | null };

/** Follow up to three Instagram pages for yourself. Their posts reach you only. */
export function MyInstagram() {
  const [mine, setMine] = useState<Mine[]>([]);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const { data } = await createClient().from("instagram_sources").select("id, handle, last_fetched_at, last_filed, last_error").order("created_at", { ascending: false });
    setMine((data || []) as Mine[]);
  };
  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function add() {
    if (busy || link.trim().length < 2) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/instagram/follow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ link }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't add that page.");
      setLink("");
      setMsg({ ok: true, text: j.requested ? j.message : j.filed ? `Following @${j.handle}. ${j.filed} recent post${j.filed === 1 ? "" : "s"} added to your Home.` : `Following @${j.handle}. New posts will reach you.` });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't add that page." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setMine((m) => m.filter((x) => x.id !== id));
    await fetch("/api/instagram/follow", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
  }

  return (
    <div className="my-ig" data-nosubmit>
      <div className="ig-add">
        <input type="text" inputMode="url" placeholder="instagram.com/pagename or @pagename" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} aria-label="Instagram page link or handle" maxLength={300} />
        <button type="button" className="primary" onClick={add} disabled={busy || link.trim().length < 2 || mine.length >= 3}>
          {busy ? "Checking…" : "Follow"}
        </button>
      </div>
      <p className="help">
        Up to 3 pages, only yours. Works for Business or Creator pages (most clubs and councils). Their posts appear on your Home like other notices.
      </p>
      {msg && <p className={msg.ok ? "help" : "err"} role="status">{msg.text}</p>}
      {mine.length > 0 && (
        <ul className="req-list">
          {mine.map((m) => (
            <li key={m.id}>
              <span>
                <Instagram aria-hidden width={14} height={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />@{m.handle}
                <br />
                <small className="help">{m.last_error ? `Can't read it: ${m.last_error}` : m.last_fetched_at ? "Up to date" : "Waiting for the first check"}</small>
              </span>
              <button type="button" className="ghost" onClick={() => remove(m.id)} aria-label={`Stop following @${m.handle}`}>
                <X aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
