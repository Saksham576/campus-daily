/** Sign-in email sent by Campus Daily itself (code + scanner-safe link). */
export function buildSigninEmail(code: string, link: string): { subject: string; html: string; text: string } {
  const safeCode = code.replace(/[^0-9]/g, "");
  const safeLink = link.replace(/"/g, "%22");
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;color:#16181A">
<h2 style="margin:0 0 12px">Your Campus Daily code</h2>
<p>Type this code in the Campus Daily tab:</p>
<p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:8px 0 18px">${safeCode}</p>
<p>Or open this link on any device and press Continue:<br><a href="${safeLink}" style="color:#C8401F">Sign in to Campus Daily</a></p>
<p style="color:#777;font-size:13px">The code and link expire in 1 hour and work once. If you didn't ask for this, you can ignore this email.</p>
</div>`;
  const text = `Your Campus Daily code: ${safeCode}\n\nOr open this link and press Continue: ${link}\n\nThe code and link expire in 1 hour and work once.`;
  return { subject: `${safeCode} is your Campus Daily code`, html, text };
}

/** At most 1 email per 30 s and 5 per hour for the same address. */
export function rateLimitReason(recentSends: string[], now = new Date()): string | null {
  const t = now.getTime();
  const times = recentSends.map((s) => new Date(s).getTime());
  if (times.some((x) => t - x < 30_000)) return "Please wait 30 seconds before asking for another code.";
  if (times.filter((x) => t - x < 3_600_000).length >= 5) return "Too many codes requested. Please try again in an hour.";
  return null;
}
