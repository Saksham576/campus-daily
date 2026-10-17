"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

const NEEDS = [1, 2, 0]; // extension version that can import (1.2.0)
const atLeast = (v: string) => {
  const p = v.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((p[i] || 0) !== NEEDS[i]) return (p[i] || 0) > NEEDS[i];
  return true;
};

/**
 * Import your exact courses (division, labs, HASMED, rooms) from your ResoBin timetable.
 * Needs the Campus Daily Connect extension and a ResoBin sign-in in the same browser.
 */
export function ResobinImport({ onDone }: { onDone?: (count: number) => void }) {
  const [ext, setExt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      if (e.data?.type === "cd-connect-pong") setExt(String(e.data.version || "1.0.0"));
    };
    window.addEventListener("message", onMsg);
    const v = document.documentElement.dataset.cdConnect;
    if (v) setExt(v === "1" ? "1.0.0" : v);
    window.postMessage({ type: "cd-connect-ping" }, window.location.origin);
    const t = setTimeout(() => window.postMessage({ type: "cd-connect-ping" }, window.location.origin), 1200);
    return () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(t);
    };
  }, []);

  async function start() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/resobin/start", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.passport) {
      setBusy(false);
      return setMsg({ ok: false, text: j.error || "Couldn't start. Try again." });
    }
    const onResult = (e: MessageEvent) => {
      if (e.source !== window || e.data?.type !== "cd-resobin-result") return;
      window.removeEventListener("message", onResult);
      setBusy(false);
      if (e.data.ok) {
        setMsg({ ok: true, text: `Imported ${e.data.count} course${e.data.count === 1 ? "" : "s"} from ResoBin.` });
        onDone?.(e.data.count);
      } else if (e.data.needSignIn) {
        setMsg({ ok: false, text: "Sign in to ResoBin in this browser (it opens in a new tab), then press Import again." });
        window.open("https://resobin.gymkhana.iitb.ac.in/timetable", "_blank", "noopener");
      } else setMsg({ ok: false, text: e.data.error || "Import failed." });
    };
    window.addEventListener("message", onResult);
    window.postMessage({ type: "cd-resobin-import", passport: j.passport, semester: j.semester }, window.location.origin);
    setTimeout(() => {
      window.removeEventListener("message", onResult);
      setBusy((b) => {
        if (b) setMsg({ ok: false, text: "No answer from the extension. Reload this page and try again." });
        return false;
      });
    }, 20000);
  }

  const ready = ext && atLeast(ext);
  return (
    <div className="push-card">
      <span className="push-ico" aria-hidden>
        <Download />
      </span>
      <div className="push-text">
        <b>Import from ResoBin</b>
        <span className="help">
          {ready
            ? "Copies your exact courses, labs, HASMED and rooms from your ResoBin timetable."
            : ext
            ? "Update the Campus Daily Connect extension to use this: download it again from Settings → Moodle, then click Reload on chrome://extensions."
            : "Needs the Campus Daily Connect extension on a laptop (see Moodle above) and your ResoBin timetable filled in."}
        </span>
      </div>
      {ready && (
        <button type="button" className="primary" onClick={start} disabled={busy}>
          {busy ? "Importing…" : "Import"}
        </button>
      )}
      {msg && (
        <p className={msg.ok ? "help" : "err"} style={{ gridColumn: "1 / -1", margin: 0 }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
