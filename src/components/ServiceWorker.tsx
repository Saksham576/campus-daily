"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // In development the cache would serve stale CSS/JS (dev chunk names don't change).
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
