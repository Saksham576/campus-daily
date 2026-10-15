import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ItemCard, type FeedItem } from "@/components/ItemCard";

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
    .select("onboarded_at, delivery_preference, personal_email, department, year, division")
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
          {items.map((it) => (
            <ItemCard key={it.id || it.item_id} item={it} />
          ))}
        </div>
      )}
    </main>
  );
}
