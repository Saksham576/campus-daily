"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

/** Latest Campus Daily Connect version (keep in sync with extension/manifest.json). */
export const EXTENSION_VERSION = "1.2.0";

const newer = (a: string, b: string) => {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

/** Always-visible download link, with the installed version and how to update. */
export function ExtensionUpdate() {
  const [installed, setInstalled] = useState<string | null>(null);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === window && e.data?.type === "cd-connect-pong") setInstalled(String(e.data.version || "1.0.0"));
    };
    window.addEventListener("message", onMsg);
    const v = document.documentElement.dataset.cdConnect;
    if (v) setInstalled(v === "1" ? "1.0.0" : v);
    window.postMessage({ type: "cd-connect-ping" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const outdated = installed && newer(EXTENSION_VERSION, installed);
  return (
    <div className="ext-line">
      <a href="/campus-daily-connect.zip" download className="btn-link">
        <Download aria-hidden />
        {installed ? (outdated ? `Update the extension (you have ${installed}, latest ${EXTENSION_VERSION})` : `Download the extension again (you have the latest, ${installed})`) : `Download the extension (${EXTENSION_VERSION})`}
      </a>
      {outdated && (
        <span className="help">
          Unzip it over your old Campus Daily Connect folder, then open <code>chrome://extensions</code> and click <b>Reload</b> on it.
        </span>
      )}
    </div>
  );
}
