"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const label = (t: number) => {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
};

/** "Updated 3 min ago", plus pull-down-to-refresh on a phone. */
export function Fresh({ at }: { at: string }) {
  const router = useRouter();
  const t0 = useRef(new Date(at).getTime());
  const [text, setText] = useState("");
  const [pull, setPull] = useState<"idle" | "ready" | "busy">("idle");

  useEffect(() => {
    t0.current = new Date(at).getTime();
    setText(label(t0.current));
    const i = setInterval(() => setText(label(t0.current)), 30_000);
    return () => clearInterval(i);
  }, [at]);

  useEffect(() => {
    let y0: number | null = null;
    let dy = 0;
    const start = (e: TouchEvent) => {
      y0 = window.scrollY <= 0 ? e.touches[0].clientY : null;
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (y0 === null) return;
      dy = e.touches[0].clientY - y0;
      setPull(dy > 90 ? "ready" : "idle");
    };
    const end = () => {
      if (y0 !== null && dy > 90) {
        setPull("busy");
        router.refresh();
        setTimeout(() => setPull("idle"), 900);
      } else setPull("idle");
      y0 = null;
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end);
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
    };
  }, [router]);

  return (
    <>
      {text && <p className="fresh">Updated {text}</p>}
      {pull !== "idle" && (
        <div className="ptr" role="status">
          <span>{pull === "busy" ? "Updating…" : "Release to update"}</span>
        </div>
      )}
    </>
  );
}
