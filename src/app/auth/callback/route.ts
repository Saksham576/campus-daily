import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  SESSION_MAX_AGE,
  isValidIitbEmail,
  sanitizeRedirectUrl,
  isPersistentSession,
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");

  const safeNext = sanitizeRedirectUrl(next);

  const rememberCookie = req.cookies.get("campus_remember_device")?.value;
  const isPersistent = isPersistentSession(rememberCookie);
  const sessionMaxAge = isPersistent ? SESSION_MAX_AGE : undefined;

  let res = NextResponse.redirect(new URL(safeNext, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bcqzlxftcsgjmgaddqjz.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_KxKyxsC0GKUM3pq1LyX4-A_FxbuQncZ",
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: any }>) => {
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

  function redirectWithCookies(targetUrl: URL) {
    const redirectRes = NextResponse.redirect(targetUrl);
    res.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c.name, c.value, c);
    });
    return redirectRes;
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      if (!isValidIitbEmail(data.user.email)) {
        await supabase.auth.signOut();
        return redirectWithCookies(new URL("/login?e=iitb", origin));
      }
      return res;
    }
  } else if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });
    if (!error && data?.user) {
      if (!isValidIitbEmail(data.user.email)) {
        await supabase.auth.signOut();
        return redirectWithCookies(new URL("/login?e=iitb", origin));
      }
      return res;
    }
  }

  return redirectWithCookies(new URL("/login?e=auth", origin));
}
