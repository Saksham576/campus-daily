"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Request = { user_id: string; email: string; name: string; department: string | null; role: string | null; status: string; requested_at: string };
type Card = { id: string; sponsor: string; title: string; body: string | null; link: string | null; active: boolean; starts_on: string; ends_on: string | null; views: number; clicks: number };

export function AdminPanel({ requests, cards }: { requests: Request[]; cards: Card[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [card, setCard] = useState({ sponsor: "", title: "", body: "", link: "", starts_on: "", ends_on: "" });

  async function act(payload: Record<string, unknown>) {
    setErr(null);
    const res = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) setErr((await res.json().catch(() => ({}))).error || "Action failed");
    else router.refresh();
    return res.ok;
  }

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  return (
    <>
      {err && <p className="err">{err}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Broadcaster requests ({pending.length} pending)</h2>
        {pending.length === 0 && <p className="muted">No pending requests.</p>}
        {pending.map((r) => (
          <article key={r.user_id} className="card">
            <h3>{r.name}</h3>
            <p className="muted small">
              {r.email} · {r.role || "—"} · {r.department || "—"}
            </p>
            <button className="primary" onClick={() => act({ type: "decide_broadcaster", user_id: r.user_id, status: "approved" })}>Approve</button>{" "}
            <button className="link" onClick={() => act({ type: "decide_broadcaster", user_id: r.user_id, status: "rejected" })}>Reject</button>
          </article>
        ))}
        {decided.length > 0 && (
          <p className="muted small">
            Decided: {decided.map((r) => `${r.name} (${r.status})`).join(", ")}
          </p>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Sponsored Today Card</h2>
        <p className="muted small">One active card shows at position 3 in every student&apos;s feed. Price: ₹400 per 1,000 views.</p>
        {cards.map((c) => (
          <article key={c.id} className="card">
            <h3>
              {c.title} <span className="muted small">— {c.sponsor}</span>
            </h3>
            <p className="muted small">
              {c.views} views · {c.clicks} clicks · {c.starts_on} → {c.ends_on || "open"} · ₹{Math.round((c.views / 1000) * 400)} billable
            </p>
            <button className="link" onClick={() => act({ type: "toggle_card", id: c.id, active: !c.active })}>
              {c.active ? "Pause" : "Activate"}
            </button>
          </article>
        ))}
        <form
          className="pform"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ type: "create_card", ...card })) setCard({ sponsor: "", title: "", body: "", link: "", starts_on: "", ends_on: "" });
          }}
        >
          <fieldset>
            <legend>New card</legend>
            <div className="row2">
              <label>
                Sponsor
                <input value={card.sponsor} onChange={(e) => setCard({ ...card, sponsor: e.target.value })} required />
              </label>
              <label>
                Link (https://)
                <input value={card.link} onChange={(e) => setCard({ ...card, link: e.target.value })} />
              </label>
            </div>
            <label>
              Title
              <input value={card.title} onChange={(e) => setCard({ ...card, title: e.target.value })} required />
            </label>
            <label>
              Text
              <textarea value={card.body} onChange={(e) => setCard({ ...card, body: e.target.value })} rows={2} />
            </label>
            <div className="row2">
              <label>
                Starts
                <input type="date" value={card.starts_on} onChange={(e) => setCard({ ...card, starts_on: e.target.value })} />
              </label>
              <label>
                Ends
                <input type="date" value={card.ends_on} onChange={(e) => setCard({ ...card, ends_on: e.target.value })} />
              </label>
            </div>
          </fieldset>
          <button className="primary">Add card</button>
        </form>
      </section>
    </>
  );
}
