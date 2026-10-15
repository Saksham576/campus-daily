"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "loading" | "none" | "pending" | "approved" | "rejected";

export default function BroadcastPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [req, setReq] = useState({ name: "", department: "", role: "Professor" });
  const [form, setForm] = useState({
    subject: "",
    body: "",
    action: "none",
    course_code: "",
    date: "",
    time: "",
    end_time: "",
    new_location: "",
    slot_type: "quiz",
  });

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("broadcasters").select("status, name").eq("user_id", user.id).maybeSingle();
    setStatus((data?.status as Status) || "none");
    setName(data?.name || "");
  }
  useEffect(() => {
    load();
  }, []);

  async function post(url: string, payload: unknown) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    return { ok: res.ok, j };
  }

  async function requestAccess(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await post("/api/broadcast/request", req);
    if (ok) load();
    else setMsg({ ok: false, text: j.error || "Could not send request." });
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await post("/api/broadcast", form);
    if (ok) {
      setMsg({ ok: true, text: `Published to ${j.students} students${j.pushed ? `, ${j.pushed} phone alerts sent` : ""}${j.timetable_update ? " and timetables updated" : ""}.` });
      setForm({ ...form, subject: "", body: "" });
    } else setMsg({ ok: false, text: j.error || "Could not publish." });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <main className="wrap narrow-form">
      <header className="top">
        <div>
          <p className="eyebrow">For Professors & TAs</p>
          <h1>Verified Broadcast</h1>
          <p className="muted">Reach students instantly. Timetable changes apply to everyone in the course.</p>
        </div>
        <div className="nav-links">
          <Link href="/" className="navlink">Feed</Link>
        </div>
      </header>

      {msg && <p className={msg.ok ? "note" : "err"} style={msg.ok ? { borderColor: "var(--green)" } : undefined}>{msg.text}</p>}

      {status === "loading" && <p className="muted">Loading…</p>}

      {status === "none" && (
        <form onSubmit={requestAccess} className="pform">
          <fieldset>
            <legend>Request access</legend>
            <label>
              Full name
              <input value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} required />
            </label>
            <div className="row2">
              <label>
                Department
                <input value={req.department} onChange={(e) => setReq({ ...req, department: e.target.value })} />
              </label>
              <label>
                Role
                <select value={req.role} onChange={(e) => setReq({ ...req, role: e.target.value })}>
                  <option>Professor</option>
                  <option>TA</option>
                  <option>Staff</option>
                </select>
              </label>
            </div>
            <span className="muted small">An admin checks and approves requests, usually within a day.</span>
          </fieldset>
          <button className="primary" disabled={busy}>{busy ? "Sending…" : "Request access"}</button>
        </form>
      )}

      {status === "pending" && <p className="note">Thanks{name ? `, ${name}` : ""}. Your request is waiting for admin approval.</p>}
      {status === "rejected" && <p className="err">Your request was not approved. Contact 26b2477@iitb.ac.in if this is a mistake.</p>}

      {status === "approved" && (
        <form onSubmit={publish} className="pform">
          <fieldset>
            <legend>New notice</legend>
            <label>
              Subject
              <input value={form.subject} onChange={set("subject")} placeholder="MA 105 quiz moved to Friday" required />
            </label>
            <label>
              Message
              <textarea value={form.body} onChange={set("body")} rows={5} />
            </label>
          </fieldset>

          <fieldset>
            <legend>Timetable change (optional)</legend>
            <label>
              What changed?
              <select value={form.action} onChange={set("action")}>
                <option value="none">Nothing — just a notice</option>
                <option value="cancelled">Class cancelled</option>
                <option value="moved">Venue or time changed</option>
                <option value="added">Quiz / exam / deadline added</option>
              </select>
            </label>
            {form.action !== "none" && (
              <>
                <div className="row2">
                  <label>
                    Course code
                    <input value={form.course_code} onChange={set("course_code")} placeholder="MA 105" required />
                  </label>
                  <label>
                    Date
                    <input type="date" value={form.date} onChange={set("date")} required />
                  </label>
                </div>
                <div className="row2">
                  <label>
                    {form.action === "cancelled" ? "Class time (optional)" : form.action === "moved" ? "New time (optional)" : "Start time"}
                    <input type="time" value={form.time} onChange={set("time")} required={form.action === "added"} />
                  </label>
                  {form.action !== "cancelled" && (
                    <label>
                      End time (optional)
                      <input type="time" value={form.end_time} onChange={set("end_time")} />
                    </label>
                  )}
                </div>
                {form.action !== "cancelled" && (
                  <label>
                    {form.action === "moved" ? "New venue (optional)" : "Venue"}
                    <input value={form.new_location} onChange={set("new_location")} placeholder="LA 201" />
                  </label>
                )}
                {form.action === "added" && (
                  <label>
                    Type
                    <select value={form.slot_type} onChange={set("slot_type")}>
                      <option value="quiz">Quiz</option>
                      <option value="exam">Exam</option>
                      <option value="deadline">Deadline</option>
                    </select>
                  </label>
                )}
              </>
            )}
          </fieldset>

          <button className="primary" disabled={busy}>{busy ? "Publishing…" : "Publish verified notice"}</button>
        </form>
      )}
    </main>
  );
}
