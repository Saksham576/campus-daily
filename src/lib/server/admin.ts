import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role client for server routes only. Returns null if not configured. */
export function getAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bcqzlxftcsgjmgaddqjz.supabase.co",
    key,
    { auth: { persistSession: false } }
  );
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "26b2477@iitb.ac.in")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email) && adminEmails().includes(email!.toLowerCase());
}
