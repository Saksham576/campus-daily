import { createBrowserClient } from "@supabase/ssr";
import { SESSION_MAX_AGE, isPersistentSession } from "@/lib/auth";

export { SESSION_MAX_AGE };

export function createClient() {
  let isPersistent = true;
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)campus_remember_device=([^;]*)/);
    if (match) {
      isPersistent = isPersistentSession(match[1]);
    } else if (typeof localStorage !== "undefined") {
      isPersistent = isPersistentSession(localStorage.getItem("campus_remember_device"));
    }
  }

  const sessionMaxAge = isPersistent ? SESSION_MAX_AGE : undefined;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bcqzlxftcsgjmgaddqjz.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_KxKyxsC0GKUM3pq1LyX4-A_FxbuQncZ",
    {
      cookieOptions: {
        sameSite: "lax",
        path: "/",
        ...(sessionMaxAge !== undefined ? { maxAge: sessionMaxAge } : {}),
      },
    }
  );
}
