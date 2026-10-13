"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/@([a-z0-9-]+\.)*iitb\.ac\.in$/i.test(email.trim())) {
      setStatus("error");
      setErrorMsg(
        "Use your IITB email (…@iitb.ac.in). You can add your personal Gmail for the digest after signing in."
      );
      return;
    }

    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  useEffect(() => {
    if (new URLSearchParams(location.search).get("e") === "iitb") {
      setStatus("error");
      setErrorMsg(
        "Campus Daily is for IITB students. Sign in with your @iitb.ac.in address."
      );
    }
  }, []);

  return (
    <main className="wrap narrow">
      <p className="eyebrow">Campus Daily</p>
      <h1>Your campus, in one feed.</h1>
      <p className="muted">
        Sign in with your IITB email. We send you a one-tap sign-in link — no password.
      </p>

      {status === "sent" ? (
        <p className="note">
          Check <b>{email}</b> for a sign-in link. It can take a minute.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="login">
          <input
            type="email"
            required
            placeholder="you@iitb.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send sign-in link"}
          </button>
          {status === "error" && <p className="err">{errorMsg}</p>}
        </form>
      )}
    </main>
  );
}
