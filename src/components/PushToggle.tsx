"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, BellOff, BellRing } from "lucide-react";

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
    return (
      <div className="push-card">
        <span className="push-ico" aria-hidden>
          <BellOff />
        </span>
        <div className="push-text">
          <b>Notifications aren&apos;t available in this browser</b>
          <span className="help">On iPhone, first tap Share → Add to Home Screen, then open Campus Daily from there.</span>
        </div>
      </div>
    );
  }
  if (state === "on") {
    return (
      <div className="push-card on">
        <span className="push-ico" aria-hidden>
          <BellRing />
        </span>
        <div className="push-text">
          <b>Notifications are on</b>
          <span className="help">You&apos;ll hear about cancelled classes, venue changes and urgent notices.</span>
        </div>
        <button type="button" className="ghost" onClick={disable}>
          Turn off
        </button>
      </div>
    );
  }
  return (
    <div className="push-card">
      <span className="push-ico" aria-hidden>
        <Bell />
      </span>
      <div className="push-text">
        <b>Get notified when a class is cancelled</b>
        <span className="help">Also venue changes and urgent notices. Never spam.</span>
      </div>
      <button type="button" className="primary" disabled={state === "busy"} onClick={enable}>
        {state === "busy" ? "Turning on…" : "Turn on notifications"}
      </button>
      {error && <p className="err" style={{ gridColumn: "1 / -1" }}>{error}</p>}
    </div>
  );
}
