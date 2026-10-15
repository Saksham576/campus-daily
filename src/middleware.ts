import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Refreshes the session on every request, ensures 1-year persistence,
// auto-redirects authenticated users away from /login, and sends logged-out users to /login.
export async function middleware(req: NextRequest) {
  return await updateSession(req);
}

export const config = {
  matcher: [
    "/((?!api/ingest/|api/cron/|api/auth/|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\..*).*)",
  ],
};
