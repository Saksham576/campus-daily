"use client";

import { useState } from "react";

const SUGGESTIONS = ["When is my next quiz?", "What's due this week?", "Any class changes tomorrow?"];

/** Ask Campus Daily: questions answered from your own notices, timetable and Moodle. */
export function AskBox() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ q: string; answer: string; sources: { n: number; id: string; subject: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: text }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't answer right now.");
      setReply({ q: text, answer: j.answer, sources: j.sources || [] });
      setQ("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't answer right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ask" aria-label="Ask Campus Daily">
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <span className="ask-ico" aria-hidden>
          ✦
        </span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about your classes, quizzes, notices…"
          aria-label="Ask Campus Daily"
          maxLength={300}
        />
        <button type="submit" className="primary" disabled={busy || q.trim().length < 3}>
          {busy ? "Thinking…" : "Ask"}
        </button>
      </form>

      {!reply && !busy && !error && (
        <div className="ask-sugg">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="ghost" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="err">{error}</p>}

      {reply && (
        <div className="ask-reply" aria-live="polite">
          <p className="ask-q">{reply.q}</p>
          <p className="ask-a">{reply.answer}</p>
          {reply.sources.length > 0 && (
            <ul className="ask-src">
              {reply.sources.map((s) => (
                <li key={s.id}>
                  <span className="from">[{s.n}]</span> {s.subject}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="link" onClick={() => setReply(null)}>
            Clear
          </button>
        </div>
      )}
    </section>
  );
}
