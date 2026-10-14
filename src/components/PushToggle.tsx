"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Turn on/off phone alerts for cancellations and urgent notices. */
export function PushToggle() {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "busy">("busy");
  const [error, setError] = useState<string | null>(null);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapid) return setState("unsupported");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapid]);

  async function enable() {
    setError(null);
    setState("busy");
    try {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked in your browser settings.");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid!) });
      const json = sub.toJSON();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const { error: dbErr } = await supabase.from("push_subscriptions").upsert({
        endpoint: sub.endpoint,
        user_id: user.id,
        email: (user.email || "").toLowerCase(),
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      if (dbErr) throw new Error("Could not save. Try again.");
      setState("on");
    } catch (e: any) {
      setError(e.message || "Could not turn on alerts.");
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  if (state === "unsupported") {
    return <p className="muted small">Phone alerts aren&apos;t supported here. On iPhone, first add Campus Daily to your Home Screen.</p>;
  }
  return (
    <div>
      <button type="button" className="link" disabled={state === "busy"} onClick={state === "on" ? disable : enable}>
        {state === "on" ? "🔔 Alerts on — turn off" : state === "busy" ? "…" : "🔕 Turn on phone alerts"}
      </button>
      <p className="muted small">Only for class cancellations, venue changes and top-priority notices.</p>
      {error && <p className="err">{error}</p>}
    </div>
  );
}
