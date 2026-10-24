"use client";

import { useEffect, useState } from "react";
import { EyeOff, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { INTEREST_GROUPS } from "@/lib/constants";
import { parseKeywords } from "@/lib/relevance";

/** Extra things people want gone that are not clubs: inter-hostel championships and Instagram posts. */
const EXTRA = ["General Championships (GC)", "Instagram posts"];

/** Topics and senders to keep off Home and out of phone alerts. Saves as you tap. */
export function HideTopics() {
  const [email, setEmail] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [muted, setMuted] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;
      const mail = user.email.toLowerCase();
      setEmail(mail);
      const { data } = await supabase.from("subscribers").select("non_interests, muted_senders").eq("email", mail).maybeSingle();
      setHidden(parseKeywords(data?.non_interests));
      setMuted((data?.muted_senders || []) as string[]);
    })().catch(() => {});
  }, []);

  async function save(patch: { non_interests?: string; muted_senders?: string[] }) {
    if (!email) return;
    setErr(null);
    const { error } = await createClient().from("subscribers").update(patch).eq("email", email);
    if (error) setErr("Couldn't save that. Try again.");
  }

  const isHidden = (k: string) => hidden.some((x) => x.toLowerCase() === k.toLowerCase());
  function toggle(k: string) {
    const next = isHidden(k) ? hidden.filter((x) => x.toLowerCase() !== k.toLowerCase()) : [...hidden, k];
    setHidden(next);
    save({ non_interests: next.join(", ") });
  }
  function unmute(sender: string) {
    const next = muted.filter((m) => m !== sender);
    setMuted(next);
    save({ muted_senders: next });
  }

  const chips = [...INTEREST_GROUPS.flatMap((g) => g.chips), ...EXTRA];
  const label = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  return (
    <details className="hide-topics" data-nosubmit>
      <summary>
        <EyeOff aria-hidden width={16} height={16} /> Hide things I don&apos;t want
        {hidden.length + muted.length > 0 && <span className="help"> · {hidden.length + muted.length} hidden</span>}
      </summary>
      <p className="help">
        Hidden topics stay off Home and out of phone alerts, even if something else you follow matches. Your own mail, Moodle and your courses are never hidden.
      </p>
      <div className="chips">
        {chips.map((c) => {
          const on = isHidden(c);
          return (
            <button key={c} type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(c)}>
              {on && <X aria-hidden className="chip-tick" />}
              {c}
            </button>
          );
        })}
      </div>
      {muted.length > 0 && (
        <>
          <h3 className="chips-title">Senders you muted</h3>
          <ul className="req-list">
            {muted.map((m) => (
              <li key={m}>
                <span>{label(m)}</span>
                <button type="button" className="ghost" onClick={() => unmute(m)} aria-label={`Unmute ${label(m)}`}>
                  Unmute
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {err && <p className="err" role="status">{err}</p>}
    </details>
  );
}
