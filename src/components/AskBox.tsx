"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Sparkles, X } from "lucide-react";

const SUGGESTIONS = ["When is my next quiz?", "What's due this week?", "Get my morning digest by email"];

/** Plain answer text; lines starting with "- " become a list. */
function AnswerText({ text }: { text: string }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const list = line.startsWith("- ");
    const last = blocks[blocks.length - 1];
    if (last && last.list === list && list) last.lines.push(line.slice(2));
    else blocks.push({ list, lines: [list ? line.slice(2) : line] });
  }
  return (
    <div className="ask-a">
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i}>
            {b.lines.map((l, k) => (
              <li key={k}>{l}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.lines[0]}</p>
        )
      )}
    </div>
  );
}

type Proposed = { action: Record<string, unknown>; label: string; state?: "busy" | "done" | "skipped" | "error" };
type Reply = { q: string; answer: string; sources: { n: number; id: string; subject: string }[]; actions: Proposed[] };

/**
 * Ask Campus Daily: answers from your own notices, timetable and Moodle — and can propose changes
 * to your settings, which only happen when you tap Confirm.
 */
export function AskBox({ request, hideInput }: { request?: { text: string; id: number } | null; hideInput?: boolean } = {}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
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
      setReply({ q: text, answer: j.answer, sources: j.sources || [], actions: j.actions || [] });
      setQ("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't answer right now.");
    } finally {
      setBusy(false);
    }
  }

  // Driven from the main search box: a new request id asks that question.
  useEffect(() => {
    if (request) ask(request.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  async function confirm(i: number) {
    if (!reply) return;
    const set = (state: Proposed["state"]) =>
      setReply((r) => (r ? { ...r, actions: r.actions.map((a, k) => (k === i ? { ...a, state } : a)) } : r));
    set("busy");
    const res = await fetch("/api/ask/act", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: reply.actions[i].action }),
    }).catch(() => null);
    if (res?.ok) {
      set("done");
      router.refresh(); // board reflects the change
    } else set("error");
  }

  const driven = request !== undefined;
  if (driven && !reply && !busy && !error) return null;

  return (
    <section className="ask" aria-label="Ask Campus Daily">
      {!driven && <div className="ask-head">
        <Sparkles aria-hidden />
        Ask Campus Daily
      </div>}
      {!driven && <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask, or tell it to change a setting…"
          aria-label="Ask Campus Daily"
          maxLength={300}
        />
        <button type="submit" className="primary" disabled={busy || q.trim().length < 3} aria-label="Ask">
          {busy ? "…" : <ArrowUp aria-hidden />}
        </button>
      </form>}

      {!driven && !reply && !busy && !error && (
        <div className="ask-sugg">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {busy && <p className="help" style={{ marginTop: 10 }}>Reading your notices…</p>}
      {error && <p className="err">{error}</p>}

      {reply && (
        <div className="ask-reply" aria-live="polite">
          <p className="ask-q">{reply.q}</p>
          <AnswerText text={reply.answer} />
          {reply.sources.length > 0 && (
            <ul className="ask-src">
              {reply.sources.map((s) => (
                <li key={s.id}>
                  [{s.n}] {s.subject}
                </li>
              ))}
            </ul>
          )}
          {reply.actions.length > 0 && (
            <div className="ask-act">
              {reply.actions.map((a, i) =>
                a.state === "done" ? (
                  <div key={i} className="ask-act-item done">
                    <span>{a.label}</span>
                    <Check aria-hidden width={16} height={16} />
                  </div>
                ) : a.state === "skipped" ? null : (
                  <div key={i} className="ask-act-item">
                    <span>{a.state === "error" ? `Couldn't do that — try Settings. (${a.label})` : a.label}</span>
                    <span className="btns">
                      <button type="button" className="primary" onClick={() => confirm(i)} disabled={a.state === "busy"}>
                        {a.state === "busy" ? "Saving…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        aria-label="Skip"
                        onClick={() => setReply((r) => (r ? { ...r, actions: r.actions.map((x, k) => (k === i ? { ...x, state: "skipped" } : x)) } : r))}
                      >
                        <X aria-hidden />
                      </button>
                    </span>
                  </div>
                )
              )}
            </div>
          )}
          <button type="button" className="link" style={{ marginTop: 8 }} onClick={() => setReply(null)}>
            Clear
          </button>
        </div>
      )}
    </section>
  );
}
