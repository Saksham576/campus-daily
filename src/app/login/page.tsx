"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  isValidIitbEmail,
  sanitizeRedirectUrl,
  sanitizeOtpCode,
  isPersistentSession,
  initialAuthMode,
  isNoAccountError,
  HAS_ACCOUNT_COOKIE,
  type AuthMode,
} from "@/lib/auth";

function markHasAccount() {
  document.cookie = `${HAS_ACCOUNT_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`;
}

function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [status, setStatus] = useState<
    "idle" | "checking" | "sending" | "verifying" | "verified" | "error"
  >("checking");
  const [errorMsg, setErrorMsg] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [mode, setMode] = useState<AuthMode>("signup");

  const otpInputRef = useRef<HTMLInputElement>(null);

  const rawNext = searchParams.get("next");
  const safeNext = sanitizeRedirectUrl(rawNext);

  // 1. Initial Mount: Check if user is already logged in for instant auto-redirect,
  // or display error banner if redirected from an auth failure.
  useEffect(() => {
    let isMounted = true;

    // Check saved remember preference
    if (typeof window !== "undefined") {
      setMode(initialAuthMode(document.cookie));
      const savedPref = localStorage.getItem("campus_remember_device");
      if (savedPref !== null) {
        const persistent = isPersistentSession(savedPref);
        setRememberDevice(persistent);
        const cookieVal = persistent ? "1" : "0";
        document.cookie = `campus_remember_device=${cookieVal}; path=/; max-age=31536000; SameSite=Lax`;
      }
    }

    // Check error query parameter
    const errCode = searchParams.get("e");
    if (errCode === "iitb") {
      setStatus("error");
      setErrorMsg(
        "Campus Daily is exclusively for IITB students. Sign in with your @iitb.ac.in address."
      );
      return;
    } else if (errCode === "auth") {
      setStatus("error");
      setErrorMsg(
        "The sign-in link expired or is invalid. Please request a new verification code below."
      );
      return;
    }

    async function checkExistingSession() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && isValidIitbEmail(session.user.email)) {
          setStatus("verified");
          window.location.href = safeNext;
          return;
        }
      } catch {
        // Not authenticated; proceed to login form
      }

      if (isMounted) {
        setStatus("idle");
      }
    }

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, [safeNext, searchParams]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus OTP input when switching to OTP step
  useEffect(() => {
    if (step === "otp" && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  function handleRememberChange(checked: boolean) {
    setRememberDevice(checked);
    if (typeof document !== "undefined") {
      const cookieVal = checked ? "1" : "0";
      document.cookie = `campus_remember_device=${cookieVal}; path=/; max-age=31536000; SameSite=Lax`;
      localStorage.setItem("campus_remember_device", cookieVal);
    }
  }

  async function handleSendCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidIitbEmail(cleanEmail)) {
      setStatus("error");
      setErrorMsg(
        "Use your IITB email (…@iitb.ac.in). You can add your personal Gmail for digests after signing in."
      );
      return;
    }

    setStatus("sending");
    setErrorMsg("");

    // Persist remember preference
    handleRememberChange(rememberDevice);

    // Campus Daily sends its own email (code + scanner-safe link); "Log in" never creates an account.
    let error: { message: string } | null = null;
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, mode, next: safeNext }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        error = { message: j.error || "Could not send the code. Try again." };
      }
    } catch {
      error = { message: "Network error. Check your connection and try again." };
    }

    if (error && mode === "login" && (error.message === "no_account" || isNoAccountError(error))) {
      setMode("signup");
      setStatus("error");
      setErrorMsg("No Campus Daily account for this email yet. Tap Sign up to create one.");
    } else if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStep("otp");
      setStatus("idle");
      setResendCooldown(30);
      setOtpCode("");
    }
  }

  async function handleVerifyOtp(codeToVerify?: string) {
    const token = sanitizeOtpCode(codeToVerify ?? otpCode);
    if (token.length !== 6) {
      setStatus("error");
      setErrorMsg("Please enter the complete 6-digit verification code sent to your email.");
      return;
    }

    setStatus("verifying");
    setErrorMsg("");

    // Ensure remember preference cookie is active
    handleRememberChange(rememberDevice);

    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token,
      type: "email",
    });

    if (error) {
      setStatus("error");
      setErrorMsg(
        error.message || "Invalid or expired verification code. Please check your email or resend."
      );
    } else if (data.session) {
      markHasAccount();
      setStatus("verified");
      // Full redirect ensures cookies are attached and middleware validates session
      window.location.href = safeNext;
    } else {
      setStatus("error");
      setErrorMsg("Could not verify session. Please try again.");
    }
  }

  function handleOtpInputChange(val: string) {
    const cleaned = sanitizeOtpCode(val);
    setOtpCode(cleaned);
    if (cleaned.length === 6) {
      handleVerifyOtp(cleaned);
    }
  }

  if (status === "checking" || status === "verified") {
    return (
      <main className="wrap narrow">
        <p className="eyebrow">Campus Daily</p>
        <h1>Welcome to Campus Daily</h1>
        <div className="login-redirect-card">
          <p className="muted">
            {status === "verified"
              ? "Signed in! Taking you to your campus feed…"
              : "Checking your session…"}
          </p>
          <div className="login-loading-bar" />
        </div>
      </main>
    );
  }

  return (
    <main className="wrap narrow">
      <p className="eyebrow">Campus Daily</p>
      <h1>Your campus, in one feed.</h1>
      <div className="auth-tabs" role="tablist" aria-label="Log in or sign up">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`auth-tab ${mode === m ? "active" : ""}`}
            onClick={() => {
              setMode(m);
              setStep("email");
              setStatus("idle");
              setErrorMsg("");
            }}
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <p className="muted">
        {mode === "login"
          ? "Welcome back! Enter your IITB email and we’ll send a 6-digit code and a one-tap link."
          : "New here? Create your account with your IITB email (@iitb.ac.in). We’ll send a 6-digit code and a one-tap link."}
      </p>

      {step === "email" ? (
        <form onSubmit={handleSendCode} className="login">
          <label htmlFor="iitb-email" className="muted small">
            IIT Bombay Email Address
          </label>
          <input
            id="iitb-email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="rollnumber@iitb.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="login-remember">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => handleRememberChange(e.target.checked)}
            />
            <span className="login-remember-text">
              <strong>Remember this device</strong> (stay signed in for 1 year)
              <small>
                Keep checked on your phone/laptop. Uncheck if on a shared or lab PC.
              </small>
            </span>
          </label>

          <button type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : mode === "login" ? "Log in" : "Sign up"}
          </button>

          {status === "error" && <p className="err">{errorMsg}</p>}
        </form>
      ) : (
        <div className="otp-box">
          <p className="muted small" style={{ marginBottom: "8px" }}>
            Code sent to <b>{email}</b>
          </p>
          <h3>Enter 6-digit verification code</h3>
          <p className="muted small">
            Check your IITB Webmail inbox (or spam folder). You don’t need to leave
            this tab.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyOtp();
            }}
            className="login"
            style={{ marginTop: "12px" }}
          >
            <div className="otp-input-wrap">
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="······"
                value={otpCode}
                onChange={(e) => handleOtpInputChange(e.target.value)}
                className="otp-code-input"
              />
            </div>

            <button
              type="submit"
              disabled={status === "verifying" || otpCode.length !== 6}
            >
              {status === "verifying" ? "Verifying code…" : "Verify & Enter"}
            </button>

            {status === "error" && <p className="err">{errorMsg}</p>}
          </form>

          <div className="note small" style={{ marginTop: "16px" }}>
            💡 <strong>Prefer magic link?</strong> You can also tap the sign-in link
            in the email on this device.
          </div>

          <div className="otp-actions">
            <button
              type="button"
              className="link"
              disabled={resendCooldown > 0 || status === "sending"}
              onClick={() => handleSendCode()}
            >
              {resendCooldown > 0
                ? `Resend code (${resendCooldown}s)`
                : "Resend code"}
            </button>

            <button
              type="button"
              className="link"
              onClick={() => {
                setStep("email");
                setErrorMsg("");
                setStatus("idle");
              }}
            >
              Change email
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="wrap narrow">
          <p className="eyebrow">Campus Daily</p>
          <h1>Your campus, in one feed.</h1>
          <p className="muted">Loading sign-in…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
