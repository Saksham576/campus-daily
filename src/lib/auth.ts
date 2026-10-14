/**
 * Authentication and session persistence constants and helpers
 * for IIT Bombay Campus Daily.
 */

// 1 year persistent session in seconds (365 days = 31,536,000s)
export const SESSION_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Validates that an email address belongs to IIT Bombay (@iitb.ac.in
 * or any department/hostel subdomain like @cse.iitb.ac.in, @ee.iitb.ac.in).
 */
export function isValidIitbEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return /@([a-z0-9-]+\.)*iitb\.ac\.in$/i.test(email.trim());
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
  // Reject protocol-relative '//', backslash escapes '/\', or any backslash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return "/";
  }
  // Reject redirects back to auth/login endpoints or API routes to prevent loops or API exposure
  if (
    trimmed === "/login" ||
    trimmed.startsWith("/login?") ||
    trimmed.startsWith("/login/") ||
    trimmed === "/auth" ||
    trimmed.startsWith("/auth?") ||
    trimmed.startsWith("/auth/") ||
    trimmed === "/verify-email" ||
    trimmed.startsWith("/verify-email?") ||
    trimmed.startsWith("/verify-email/") ||
    trimmed === "/api" ||
    trimmed.startsWith("/api?") ||
    trimmed.startsWith("/api/")
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
