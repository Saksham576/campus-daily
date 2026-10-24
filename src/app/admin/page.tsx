import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient, isAdminEmail } from "@/lib/server/admin";
import { AdminPanel } from "./AdminPanel";
import { AutoRefresh } from "./AutoRefresh";
import { AppBar } from "@/components/AppBar";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();

  const admin = getAdminClient();
  if (!admin) return <main className="wrap"><p className="err">SUPABASE_SERVICE_ROLE_KEY is not set.</p></main>;

  const [{ data: requests }, { data: cards }, { count: students }, { count: pushDevices }, { data: bridge }, { count: moodleConns }] = await Promise.all([
    admin.from("broadcasters").select("*").order("requested_at", { ascending: false }),
    admin.from("sponsored_cards").select("*").order("created_at", { ascending: false }),
    admin.from("subscribers").select("email", { count: "exact", head: true }).is("merged_into", null),
    admin.from("push_subscriptions").select("endpoint", { count: "exact", head: true }),
    admin.from("bridge_status").select("data, updated_at").eq("id", "whatsapp").maybeSingle(),
    admin.from("moodle_connections").select("user_id", { count: "exact", head: true }),
  ]);
  // Your own recent Ask conversations (only the owner's are kept in full).
  const { data: askTurns } = await admin
    .from("ask_log")
    .select("asked_at, question, answer, ok")
    .not("question", "is", null)
    .order("asked_at", { ascending: false })
    .limit(15);
  const wa = (bridge?.data || {}) as { groups?: string[]; seenToday?: number; forwardedToday?: number; caughtUp?: number; qr?: string | null; code?: string | null };
  const waAgeMin = bridge?.updated_at ? Math.round((Date.now() - new Date(bridge.updated_at).getTime()) / 60000) : null;
  // The bridge is logged out and waiting: show its login QR (codes rotate every ~20 s; reload for a fresh one).
  const waQr = wa.qr && waAgeMin !== null && waAgeMin < 2 ? await QRCode.toString(wa.qr, { type: "svg", margin: 1, width: 240 }) : null;

  return (
    <>
    <AppBar />
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
      <section className="board" aria-label="Sources">
        <div className="board-head">
          <div className="board-title">Sources <span>▸</span></div>
        </div>
        <div className="board-row" style={{ gridTemplateColumns: "140px 1fr auto" }}>
          <span className="c">WHATSAPP</span>
          <span className="n" style={{ whiteSpace: "normal" }}>
            {waAgeMin === null
              ? "Bridge has not reported yet"
              : wa.qr
              ? "Not logged in to WhatsApp yet. Scan the QR code below."
              : !wa.groups?.length
              ? "Logged in but watching 0 groups, so it is not reading anything. Restart it: docker compose restart"
              : `${wa.groups?.length || 0} groups · ${wa.seenToday || 0} messages read today · ${wa.forwardedToday || 0} sent · ${wa.caughtUp || 0} caught up after sleep`}
          </span>
          <span className={`status ${waAgeMin !== null && waAgeMin < 25 ? "go" : "stop"}`}>
            {waAgeMin === null ? "Offline" : waAgeMin < 25 ? "Live" : `Last seen ${waAgeMin} min`}
          </span>
        </div>
        <div className="board-row" style={{ gridTemplateColumns: "140px 1fr auto" }}>
          <span className="c">MOODLE</span>
          <span className="n">{moodleConns ?? 0} student(s) connected · read every 30 min</span>
          <span className={`status ${moodleConns ? "go" : "done"}`}>{moodleConns ? "On" : "None yet"}</span>
        </div>
        <div className="board-row" style={{ gridTemplateColumns: "140px 1fr auto" }}>
          <span className="c">EMAIL</span>
          <span className="n">campusdaily.inbox@gmail.com · checked every 10 min</span>
          <span className="status go">On</span>
        </div>
        {wa.groups && wa.groups.length > 0 && <div className="board-empty">Groups: {wa.groups.join(" · ")}</div>}
        {wa.code && waAgeMin !== null && waAgeMin < 2 && (
          <div className="note">
            <AutoRefresh seconds={8} />
            <b style={{ fontSize: 28, letterSpacing: 4 }}>{wa.code}</b>
            <p>
              On the phone: WhatsApp → Settings → Linked devices → Link a device → <b>Link with phone number instead</b>, then type this code.
            </p>
          </div>
        )}
        {waQr && !wa.code && (
          <div className="note" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <AutoRefresh seconds={8} />
            <div style={{ background: "#fff", padding: 8, borderRadius: 8, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: waQr }} />
            <span>
              The WhatsApp bridge is waiting to log in. On the spare phone: WhatsApp → Settings → Linked devices → Link a device, and
              scan this. This code refreshes itself every few seconds; scan it right after it appears.
            </span>
          </div>
        )}
      </section>
      <section className="board" aria-label="Ask conversations">
        <div className="board-head">
          <div className="board-title">Your recent Ask chats <span>▸</span></div>
        </div>
        {(askTurns || []).length === 0 ? (
          <p className="muted" style={{ padding: 14 }}>Nothing yet. Questions you ask from now on are kept here so wrong answers can be traced.</p>
        ) : (
          (askTurns || []).map((a, i) => (
            <div key={i} className="board-row" style={{ gridTemplateColumns: "92px 1fr", alignItems: "start" }}>
              <span className="c">{new Date(a.asked_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
              <span className="n" style={{ whiteSpace: "pre-wrap" }}>
                <b>{a.question}</b>
                {"\n"}
                {a.ok === false ? "⚠ " : ""}
                {a.answer}
              </span>
            </div>
          ))
        )}
      </section>
      <AdminPanel requests={requests || []} cards={cards || []} />
    </main>
    </>
  );
}
