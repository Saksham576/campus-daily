import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient, isAdminEmail } from "@/lib/server/admin";
import { AdminPanel } from "./AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();

  const admin = getAdminClient();
  if (!admin) return <main className="wrap"><p className="err">SUPABASE_SERVICE_ROLE_KEY is not set.</p></main>;

  const [{ data: requests }, { data: cards }, { count: students }, { count: pushDevices }] = await Promise.all([
    admin.from("broadcasters").select("*").order("requested_at", { ascending: false }),
    admin.from("sponsored_cards").select("*").order("created_at", { ascending: false }),
    admin.from("subscribers").select("email", { count: "exact", head: true }).is("merged_into", null),
    admin.from("push_subscriptions").select("endpoint", { count: "exact", head: true }),
  ]);

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Campus Daily Admin</h1>
          <p className="muted">
            {students ?? 0} students · {pushDevices ?? 0} phones with alerts on
          </p>
        </div>
        <div className="nav-links">
          <Link href="/" className="navlink">Feed</Link>
        </div>
      </header>
      <AdminPanel requests={requests || []} cards={cards || []} />
    </main>
  );
}
