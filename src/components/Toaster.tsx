"use client";

import { useEffect, useRef, useState } from "react";

type ToastMsg = { text: string; undo?: () => void };
const EVENT = "cd-toast";

/** One shared "Done · Undo" message for every reversible action in the app. */
export function toast(text: string, undo?: () => void) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<ToastMsg>(EVENT, { detail: { text, undo } }));
}

export function Toaster() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const on = (e: Event) => {
      setMsg((e as CustomEvent<ToastMsg>).detail);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 6000);
    };
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener(EVENT, on);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="toaster" role="status" aria-live="polite">
      {msg && (
        <div className="toast">
          <span>{msg.text}</span>
          {msg.undo && (
            <button
              type="button"
              className="link"
              onClick={() => {
                msg.undo?.();
                setMsg(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
