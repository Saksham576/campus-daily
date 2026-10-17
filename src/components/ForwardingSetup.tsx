"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Settings → IITB mail: your private forwarding address and how to set the webmail rule. */
export function ForwardingSetup() {
  const [address, setAddress] = useState<string | null>(null);
  const [lastMailAt, setLastMailAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/forwarding")
      .then((r) => r.json())
      .then((j) => {
        if (j.address) {
          setAddress(j.address);
          setLastMailAt(j.lastMailAt);
        } else setError(j.error || "Couldn't load your address.");
      })
      .catch(() => setError("Couldn't load your address."));
  }, []);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (error) return <p className="err">{error}</p>;
  if (!address) return <p className="help">Loading…</p>;

  return (
    <>
      <div className="field">
        <span>Your private forwarding address</span>
        <div className="ask-form">
          <input type="text" readOnly value={address} onFocus={(e) => e.currentTarget.select()} aria-label="Your forwarding address" />
          <button type="button" onClick={copy}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <span className="help">
          {lastMailAt
            ? `Working — last mail received ${new Date(lastMailAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.`
            : "Not set up yet — nothing received from your inbox."}
        </span>
      </div>
      <ol className="steps">
        <li>
          Open{" "}
          <a href="https://webmail.iitb.ac.in" target="_blank" rel="noopener noreferrer">
            IITB webmail
          </a>{" "}
          → <b>Settings</b> → <b>Filters</b>, and create a new filter named <b>Campus Daily</b>.
        </li>
        <li>
          Set it to apply to <b>all messages</b>, with the action <b>Send message copy to</b> (or <b>Redirect a copy</b>) and paste the address
          above.
        </li>
        <li>Save. Your mail still arrives in your inbox as usual — Campus Daily just gets a copy.</li>
      </ol>
      <p className="help">
        Mailing-list mail (student notices, events, hostel lists) is shared with everyone it&apos;s meant for. Mail sent to you personally is
        shown to you alone. Sign-in codes, security alerts and mail from outside IITB are never kept. Remove the filter any time to stop.
      </p>
    </>
  );
}
