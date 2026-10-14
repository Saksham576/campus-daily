import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_MAX_AGE,
  isValidIitbEmail,
  sanitizeRedirectUrl,
  isPersistentSession,
} from "@/lib/auth";

export { SESSION_MAX_AGE };

export async function updateSession(req: NextRequest) {
  let res = NextResponse.next({
    request: req,
  });

  const rememberCookie = req.cookies.get("campus_remember_device")?.value;
  // Default to persistent session (1 year) unless user explicitly chose not to remember
  const isPersistent = isPersistentSession(rememberCookie);
  const sessionMaxAge = isPersistent ? SESSION_MAX_AGE : undefined;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bcqzlxftcsgjmgaddqjz.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_KxKyxsC0GKUM3pq1LyX4-A_FxbuQncZ",
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const isDeleting =
              options?.maxAge === 0 ||
              value === "" ||
              (options?.maxAge !== undefined && options.maxAge <= 0);

            if (isDeleting) {
              req.cookies.delete(name);
            } else {
              req.cookies.set(name, value);
            }
          });
          res = NextResponse.next({
            request: req,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            const isDeleting =
              options?.maxAge === 0 ||
              value === "" ||
              (options?.maxAge !== undefined && options.maxAge <= 0);

            const finalOptions = {
              ...options,
              sameSite: "lax" as const,
              path: "/",
              ...(isDeleting
                ? { maxAge: 0 }
                : sessionMaxAge !== undefined
                ? { maxAge: sessionMaxAge }
                : { maxAge: undefined }),
            };
            res.cookies.set(name, value, finalOptions);
          });
        },
      },
      cookieOptions: {
        sameSite: "lax",
        path: "/",
        ...(sessionMaxAge !== undefined ? { maxAge: sessionMaxAge } : {}),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isAuth =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/privacy") ||
    path.startsWith("/verify-email");

  // Helper to attach all current cookies to any redirect response
  function redirectWithCookies(targetUrl: URL) {
    const redirectRes = NextResponse.redirect(targetUrl);
    res.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c.name, c.value, c);
    });
    return redirectRes;
  }

  // 1. If user is already authenticated with a valid IITB email and visits /login, auto-redirect to / or ?next=
  if (user && isValidIitbEmail(user.email) && path.startsWith("/login")) {
    const nextParam = req.nextUrl.searchParams.get("next");
    const safeNext = sanitizeRedirectUrl(nextParam);
    const targetUrl = new URL(safeNext, req.url);
    return redirectWithCookies(targetUrl);
  }

  // 2. Campus Daily is currently for IITB students: other addresses are logged out
  if (user && !isValidIitbEmail(user.email)) {
    await supabase.auth.signOut();
    return redirectWithCookies(new URL("/login?e=iitb", req.url));
  }

  // 3. Protected route: redirect unauthenticated user to /login (or return 401 for /api/)
  if (!user && !isAuth) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    if (path !== "/" && path !== "") {
      loginUrl.searchParams.set("next", path);
    }
    return redirectWithCookies(loginUrl);
  }

  return res;
}
