/**
 * Who may open /admin. The built-in owners are always included; ADMIN_EMAILS (comma-separated, set on Vercel)
 * can add more. Pure, so the sign-in page can use it too: only these addresses may sign in without an IITB email.
 */
export const OWNER_EMAILS = ["26b2477@iitb.ac.in", "virajtiwari52@gmail.com"];

export function adminEmails(): string[] {
  const extra = (typeof process !== "undefined" ? process.env.ADMIN_EMAILS || "" : "").split(",");
  return [...new Set([...OWNER_EMAILS, ...extra].map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email) && adminEmails().includes(email!.trim().toLowerCase());
}
