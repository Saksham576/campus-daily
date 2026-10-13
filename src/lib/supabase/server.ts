import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SESSION_MAX_AGE, isPersistentSession } from "@/lib/auth";

export { SESSION_MAX_AGE };

export async function createClient() {
  const cookieStore = await cookies();
  const rememberCookie = cookieStore.get("campus_remember_device")?.value;
  const isPersistent = isPersistentSession(rememberCookie);
  const sessionMaxAge = isPersistent ? SESSION_MAX_AGE : undefined;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bcqzlxftcsgjmgaddqjz.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_KxKyxsC0GKUM3pq1LyX4-A_FxbuQncZ",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const cookieOpts = {
                ...options,
                sameSite: "lax" as const,
                path: "/",
                ...(sessionMaxAge !== undefined
                  ? { maxAge: sessionMaxAge }
                  : { maxAge: undefined }),
              };
              cookieStore.set(name, value, cookieOpts);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
      cookieOptions: {
        sameSite: "lax",
        path: "/",
        ...(sessionMaxAge !== undefined ? { maxAge: sessionMaxAge } : {}),
      },
    }
  );
}
