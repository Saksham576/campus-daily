import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Fragment } from "react";
import { ItemCard, type FeedItem } from "@/components/ItemCard";
import { SponsoredCard, type Sponsored } from "@/components/SponsoredCard";

export const dynamic = "force-dynamic";

const MIN_SCORE = 4;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if subscriber profile exists and has completed onboarding
  const { data: profile } = await supabase
    .from("subscribers")
    .select("onboarded_at, delivery_preference, personal_email, department, year, division, last_seen_at")
    .eq("email", user.email)
    .single();

  if (!profile?.onboarded_at) {
    redirect("/settings?onboarding=1");
  }

  const since = new Date(Date.now() - 7 * 864e5).toISOString();

  // me_feed joins items with this student's own scores in user_items (see migration 0005)
  let items: FeedItem[] = [];
  let fetchError: string | null = null;

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("me_feed", {
      p_since: since,
      p_min_score: MIN_SCORE,
    });
    if (rpcError) fetchError = rpcError.message;
    else items = (rpcData || []) as FeedItem[];
  } catch (err: any) {
    fetchError = err.message;
  }

  // Sponsored Today Card (position 3)
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: cards } = await supabase
    .from("sponsored_cards")
    .select("id, sponsor, title, body, link, ends_on")
    .lte("starts_on", today)
    .order("created_at", { ascending: false })
    .limit(5);
  const sponsored = ((cards || []) as (Sponsored & { ends_on: string | null })[]).find(
    (c) => !c.ends_on || c.ends_on >= today
  );

  // Inactivity tracking for the reminder email (at most one write per hour)
  if (!profile?.last_seen_at || Date.now() - new Date(profile.last_seen_at).getTime() > 3600 * 1000) {
    await supabase
      .from("subscribers")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("email", (user.email || "").toLowerCase());
  }

  // Sort items: personal first, then score descending, then received_at descending
  items.sort(
    (a, b) =>
      Number(Boolean(b.is_personal)) - Number(Boolean(a.is_personal)) ||
      (b.score || 0) - (a.score || 0) ||
      (b.received_at || "").localeCompare(a.received_at || "")
  );

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">Campus Daily</p>
          <h1>Your last 7 days</h1>
        </div>
        <div className="nav-links">
          <Link href="/schedule" className="navlink">
            📅 Timetable
          </Link>
          <Link href="/settings" className="navlink">
            Settings
          </Link>
        </div>
      </header>

      {profile?.delivery_preference !== "app" && (
        <p className="note small">
          Digest delivery to <b>{profile?.personal_email || user.email}</b> is
          enabled; until the evening digest goes out, read here.
        </p>
      )}

      {fetchError && (
        <p className="err">Could not load feed: {fetchError}</p>
      )}

      {items.length === 0 ? (
        <p className="note" style={{ color: "var(--muted)" }}>
          Nothing here yet. Feed fills after the evening ingestion run (around 6 pm) or when new notices are received.
        </p>
      ) : (
        <div style={{ marginTop: 20 }}>
          {items.map((it, idx) => (
            <Fragment key={it.id || it.item_id}>
              {idx === 2 && sponsored && <SponsoredCard card={sponsored} />}
              <ItemCard item={it} />
            </Fragment>
          ))}
          {items.length <= 2 && sponsored && <SponsoredCard card={sponsored} />}
        </div>
      )}
    </main>
  );
}
