"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Prompt = Event & { prompt: () => Promise<void> };

/** One-time "Add to Home Screen" card (from the second visit). iPhone alerts only work from the Home Screen. */
export function InstallCard() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    try {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      const visits = Number(localStorage.getItem("cd_visits") || 0) + 1;
      localStorage.setItem("cd_visits", String(visits));
      if (!standalone && !localStorage.getItem("cd_install_gone") && visits >= 2 && window.matchMedia("(max-width: 900px)").matches) {
        setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
        setShow(true);
      }
    } catch {}
    const on = (e: Event) => {
      e.preventDefault();
      setPrompt(e as Prompt);
    };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  if (!show) return null;
  const hide = () => {
    setShow(false);
    try {
      localStorage.setItem("cd_install_gone", "1");
    } catch {}
  };
  return (
    <section className="install" aria-label="Install the app">
      <div>
        <b>Keep Campus Daily on your phone</b>
        {ios ? (
          <span>Tap the Share button in Safari, then “Add to Home Screen”. Phone alerts for cancelled classes only work from the Home Screen.</span>
        ) : (
          <span>Add it to your home screen so it opens like an app and can send alerts.</span>
        )}
        {prompt && (
          <div className="btns">
            <button
              type="button"
              className="primary"
              onClick={async () => {
                await prompt.prompt();
                hide();
              }}
            >
              Install
            </button>
          </div>
        )}
      </div>
      <button type="button" className="ghost" aria-label="Dismiss" onClick={hide}>
        <X aria-hidden />
      </button>
    </section>
  );
}
