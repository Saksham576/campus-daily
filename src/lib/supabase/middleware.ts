import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bcqzlxftcsgjmgaddqjz.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_KxKyxsC0GKUM3pq1LyX4-A_FxbuQncZ",
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
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
    path.startsWith("/verify-email");

  if (!user && !isAuth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Campus Daily is currently IITB students: other addresses are logged out
  if (user && !/@([a-z0-9-]+\.)*iitb\.ac\.in$/i.test(user.email || "")) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?e=iitb", req.url));
  }

  return res;
}
