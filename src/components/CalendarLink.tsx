"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Private, live-updating calendar link for Google / Apple Calendar. */
export function CalendarLink() {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load(create = false) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    let { data } = await supabase.from("calendar_tokens").select("token").maybeSingle();
    if (!data && create) {
      ({ data } = await supabase.from("calendar_tokens").insert({ user_id: user.id }).select("token").single());
    }
    if (data?.token) setUrl(`${location.origin}/api/calendar/${data.token}.ics`);
  }
  useEffect(() => {
    load();
  }, []);

  async function reset() {
    await createClient().from("calendar_tokens").delete().neq("token", "00000000-0000-0000-0000-000000000000");
    setUrl(null);
    await load(true);
  }

  if (!url) {
    return (
      <div className="list-row">
        <span>
          <b>Live calendar</b>
          <br />
          <span className="help">Your classes in Google/Apple Calendar — cancellations and quizzes update by themselves.</span>
        </span>
        <button type="button" onClick={() => load(true)}>
          Create link
        </button>
      </div>
    );
  }

  const webcal = url.replace(/^https?:/, "webcal:");
  return (
    <div>
      <div className="list-row">
        <span>
          <b>Live calendar</b>
          <br />
          <span className="help">Keep this link private — anyone with it can see your timetable.</span>
        </span>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <a className="navlink" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">
            Google
          </a>
          <a className="navlink" href={webcal}>
            Apple
          </a>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </div>
      <button type="button" className="link" onClick={reset}>
        Reset link (old one stops working)
      </button>
    </div>
  );
}
