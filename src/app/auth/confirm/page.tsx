import { sanitizeRedirectUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Landing page for the email sign-in link.
 * Email security scanners open links automatically, which used up one-time links before
 * students could click them. Verification now happens only when a person presses the button,
 * and it uses token_hash (no browser-specific PKCE cookie), so it works on any device.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;
  const valid = typeof token_hash === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(token_hash);
  const safeType = type === "magiclink" || type === "signup" || type === "email" ? type : "email";
  const target = `/auth/callback?token_hash=${encodeURIComponent(token_hash || "")}&type=${safeType}&next=${encodeURIComponent(
    sanitizeRedirectUrl(next)
  )}`;

  return (
    <main id="main" className="wrap narrow">
      <p className="eyebrow">Campus Daily</p>
      <h1>{valid ? "One tap to sign in" : "This link looks incomplete"}</h1>
      {valid ? (
        <>
          <p className="muted">Press the button to finish signing in on this device.</p>
          <form method="get" action="/auth/callback" className="login" style={{ marginTop: 16 }}>
            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={safeType} />
            <input type="hidden" name="next" value={sanitizeRedirectUrl(next)} />
            <button type="submit">Continue to Campus Daily</button>
          </form>
          <noscript>
            <p className="muted small">
              <a href={target}>Continue</a>
            </p>
          </noscript>
        </>
      ) : (
        <p className="muted">
          Please go back to <a href="/login">the sign-in page</a> and use the 6-digit code from the email instead.
        </p>
      )}
    </main>
  );
}
