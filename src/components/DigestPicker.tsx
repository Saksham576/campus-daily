"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const OPTIONS = [
  { v: "push", label: "Phone alert" },
  { v: "email", label: "Email" },
  { v: "both", label: "Both" },
  { v: "off", label: "Off" },
] as const;

/** How the 7:30 AM digest (today's classes, what's due, next exam) reaches you. */
export function DigestPicker() {
  const [value, setValue] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [devices, setDevices] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data } = await supabase.from("subscribers").select("digest").eq("email", user.email.toLowerCase()).maybeSingle();
      setValue(data?.digest || "push");
      const { count } = await supabase.from("push_subscriptions").select("endpoint", { count: "exact", head: true });
      setDevices(count ?? 0);
    })();
  }, []);

  async function pick(v: string) {
    setValue(v);
    setSaved(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    const { error } = await supabase.from("subscribers").update({ digest: v }).eq("email", user.email.toLowerCase());
    setSaved(!error);
  }

  return (
    <div className="field" style={{ marginTop: 14 }}>
      <span>Morning digest at 7:30</span>
      <div className="seg" role="radiogroup" aria-label="Morning digest">
        {OPTIONS.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v} className={value === o.v ? "on" : ""} onClick={() => pick(o.v)} disabled={value === null}>
            {o.label}
          </button>
        ))}
      </div>
      {devices === 0 && (value === "push" || value === "both") && (
        <span className="note small" style={{ marginTop: 0 }}>
          Phone alerts aren&apos;t on for this device, so the digest can&apos;t reach you by phone yet.{" "}
          <button type="button" className="link" onClick={() => pick(value === "both" ? "email" : "email")}>
            Send it by email instead
          </button>
        </span>
      )}
      <span className="help">
        Today&apos;s classes, what&apos;s due this week and your next exam. Phone alerts need alerts turned on above.
        {saved && " Saved."}
      </span>
    </div>
  );
}
