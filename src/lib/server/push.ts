import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:26b2477@iitb.ac.in", pub, priv);
  configured = true;
  return true;
}

/** Send a push to every device registered by these students. Prunes dead subscriptions. */
export async function pushToEmails(admin: SupabaseClient, emails: string[], payload: PushPayload): Promise<number> {
  if (emails.length === 0 || !configure()) return 0;
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("email", emails.map((e) => e.toLowerCase()));
  let sent = 0;
  await Promise.all(
    (subs || []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 6 * 3600, urgency: "high" }
        );
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    })
  );
  return sent;
}
