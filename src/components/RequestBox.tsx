"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Kind = "group" | "service" | "idea";
const KINDS: { key: Kind; label: string; placeholder: string }[] = [
  { key: "group", label: "A group or page to add", placeholder: "e.g. Our department WhatsApp group, the Hostel 9 Instagram page, the Chess club mailing list" },
  { key: "service", label: "A service I need", placeholder: "e.g. Mess menu for today, bus timings, library seat booking" },
  { key: "idea", label: "Something else", placeholder: "Anything you wish Campus Daily did" },
];

type Mine = { id: number; kind: Kind; text: string; status: string };

/** Tell the owner what is missing. Saved in the database (owner reads it in /admin); you can see your own list here. */
export function RequestBox({ context = "settings" }: { context?: string }) {
  const [kind, setKind] = useState<Kind>("group");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [mine, setMine] = useState<Mine[]>([]);

  const load = async () => {
    const { data } = await createClient().from("feature_requests").select("id, kind, text, status").order("created_at", { ascending: false }).limit(5);
    setMine((data || []) as Mine[]);
  };
  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function send() {
    const t = text.trim();
    if (t.length < 3 || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Please sign in again.");
      const { error: e } = await supabase.from("feature_requests").insert({ email: user.email.toLowerCase(), user_id: user.id, kind, text: t.slice(0, 1000), context });
      if (e) throw new Error(e.message);
      setText("");
      setDone(true);
      setTimeout(() => setDone(false), 4000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const cur = KINDS.find((k) => k.key === kind)!;
  return (
    <div className="request-box" data-nosubmit>
      <div className="chips" role="radiogroup" aria-label="What are you asking for">
        {KINDS.map((k) => (
          <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} className={`chip ${kind === k.key ? "on" : ""}`} onClick={() => setKind(k.key)}>
            {k.label}
          </button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 12 }}>
        <span className="sr-only">Your request</span>
        <textarea rows={3} maxLength={1000} placeholder={cur.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="actions" style={{ marginTop: 8 }}>
        <button type="button" className="primary" onClick={send} disabled={busy || text.trim().length < 3}>
          {busy ? "Sending…" : "Send to the team"}
        </button>
        {done && (
          <span className="help" role="status">
            <Check aria-hidden width={14} height={14} /> Thanks, we&apos;ve got it.
          </span>
        )}
      </div>
      {error && <p className="err">{error}</p>}
      {mine.length > 0 && (
        <ul className="req-list">
          {mine.map((r) => (
            <li key={r.id}>
              <span>{r.text}</span>
              <small className="help">{r.status === "new" ? "Received" : r.status === "planned" ? "Planned" : r.status === "done" ? "Done" : "Not now"}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
