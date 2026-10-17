import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Cron callers: GitHub Actions / Vercel (CRON_SECRET) or Supabase pg_cron (a key kept in the DB vault). */
export async function isCronAuthorized(req: NextRequest, admin: SupabaseClient | null): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
  if (!admin) return false;
  const { data } = await admin.rpc("check_cron_key", { k: token });
  return data === true;
}
