/**
 * Authentication and session persistence constants and helpers
 * for IIT Bombay Campus Daily.
 */

import { isAdminEmail } from "./adminEmails.ts";

// 1 year persistent session in seconds (365 days = 31,536,000s)
export const SESSION_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Validates that an email address belongs to IIT Bombay (@iitb.ac.in
 * or any department/hostel subdomain like @cse.iitb.ac.in, @ee.iitb.ac.in).
 */
export function isValidIitbEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)*iitb\.ac\.in$/i.test(email.trim());
}

/**
 * Sanitizes redirect target URLs to prevent open redirect vulnerabilities
 * and infinite redirect loops.
 * Only internal relative paths starting with a single '/' are permitted.
 * Backslashes, protocol-relative slashes, and auth loop destinations (/login, /auth)
 * are rejected, falling back to "/".
 */
export function sanitizeRedirectUrl(nextUrl: string | null | undefined): string {
  if (!nextUrl || typeof nextUrl !== "string") return "/";
  const trimmed = nextUrl.trim();

  // Decode URI components safely to catch encoded bypasses (e.g. /%5cevil.com, /%2f/evil.com)
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return "/";
  }

  // Reject protocol-relative '//', backslash escapes '/\', or any backslash in raw or decoded
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\")
  ) {
    return "/";
  }

  // Extract clean pathname (lowercased, without query params or hash fragments)
  const pathname = trimmed.toLowerCase().split(/[?#]/)[0];
  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/verify-email" ||
    pathname.startsWith("/verify-email/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  ) {
    return "/";
  }
  return trimmed;
}

/**
 * Normalizes OTP input to a clean 6-digit numeric string.
 */
export function sanitizeOtpCode(code: string | null | undefined): string {
  if (!code || typeof code !== "string") return "";
  return code.replace(/\D/g, "").slice(0, 6);
}

/**
 * Determines whether session persistence is enabled.
 * Defaults to true unless explicitly disabled ("0").
 */
export function isPersistentSession(rememberValue: string | null | undefined): boolean {
  return rememberValue !== "0";
}

/** Cookie marking that someone has signed in on this device before (shows "Log in" first). */
export const HAS_ACCOUNT_COOKIE = "campus_has_account";

export type AuthMode = "login" | "signup";

/** Returning devices start on "Log in"; first-time visitors on "Sign up". */
export function initialAuthMode(cookieHeader: string | null | undefined): AuthMode {
  return /(?:^|;\s*)campus_has_account=1(?:;|$)/.test(cookieHeader || "") ? "login" : "signup";
}

/** Supabase's reply when "Log in" (shouldCreateUser: false) is used for an email with no account. */
export function isNoAccountError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "otp_disabled" || /signups? not allowed|user not found/i.test(error.message || "");
}

/** May sign in: an IITB address, or one of the owners (admins) with another address. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  return isValidIitbEmail(email) || isAdminEmail(email);
}
