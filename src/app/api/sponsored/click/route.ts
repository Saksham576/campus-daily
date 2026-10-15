import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/admin";

/** GET /api/sponsored/click?id= — counts a click, then redirects to the card's stored link. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const admin = getAdminClient();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(new URL("/", req.url));

  const { data: card } = await admin.from("sponsored_cards").select("link, clicks, active").eq("id", id).maybeSingle();
  if (!card?.link || !card.active) return NextResponse.redirect(new URL("/", req.url));

  await admin.from("sponsored_cards").update({ clicks: (card.clicks || 0) + 1 }).eq("id", id);
  return NextResponse.redirect(card.link);
}
