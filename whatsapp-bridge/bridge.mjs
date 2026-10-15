/**
 * Campus Daily WhatsApp bridge — runs on your PC.
 *
 * Safety & privacy by design:
 *  - Read-only: never sends messages, never marks chats as read.
 *  - Only the groups in GROUPS (.env), and by default only posts by group ADMINS.
 *  - Shares only the group name + message text — never author names or numbers.
 *  - Stores no message content on disk; logs only counts.
 *
 * Uses whatsapp-web.js (unofficial WhatsApp Web automation). This breaks WhatsApp's terms,
 * so there is always some risk to the linked number. Read-only use keeps that risk low.
 *
 *   cd whatsapp-bridge && npm install && npm start   (scan the QR once: WhatsApp > Linked devices)
 */
import "dotenv/config";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
import { toIngestPayload, isRelevant, parseGroups, isAllowedGroup } from "./lib.mjs";

const { Client, LocalAuth } = pkg;

const INGEST_URL = process.env.INGEST_URL || "https://campusdaily.nexuspulsetech.com/api/ingest/email";
const SECRET = process.env.INGEST_SECRET_KEY;
const GROUPS = parseGroups(process.env.GROUPS);
const ADMINS_ONLY = (process.env.ADMINS_ONLY || "true").toLowerCase() !== "false";

if (!SECRET || GROUPS.length === 0) {
  console.error("Set INGEST_SECRET_KEY and GROUPS in whatsapp-bridge/.env first.");
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
  puppeteer: { headless: true, args: ["--no-sandbox"] },
});

client.on("qr", (qr) => {
  console.log("\nScan with your phone: WhatsApp > Settings > Linked devices > Link a device\n");
  qrcode.generate(qr, { small: true });
});
client.on("ready", async () => {
  const chats = await client.getChats().catch(() => []);
  const found = chats.filter((c) => c.isGroup && isAllowedGroup(c.name, GROUPS)).length;
  console.log(`Bridge ready (read-only${ADMINS_ONLY ? ", admins only" : ""}). Watching ${found}/${GROUPS.length} group(s).`);
  if (found < GROUPS.length) console.log("Some group names in .env were not found — check spelling.");
});
client.on("disconnected", (r) => {
  console.error("Disconnected:", r, "— restarting in 60s");
  setTimeout(() => client.initialize(), 60000);
});

let sent = 0;
async function send(payload, attempt = 1) {
  try {
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ingest-secret": SECRET },
      body: JSON.stringify(payload),
    });
    if (res.ok || res.status === 422 || res.status === 400) {
      sent++;
      console.log(`${new Date().toISOString()} forwarded notice #${sent} (HTTP ${res.status})`);
      return;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    if (attempt >= 5) return console.error("Giving up on one message:", e.message);
    setTimeout(() => send(payload, attempt + 1), attempt * 60000);
  }
}

async function isFromAdmin(msg, chat) {
  if (!ADMINS_ONLY) return true;
  const author = msg.author || msg.from;
  const p = (chat.participants || []).find((x) => x.id?._serialized === author);
  return Boolean(p && (p.isAdmin || p.isSuperAdmin));
}

client.on("message", async (msg) => {
  try {
    const chat = await msg.getChat();
    if (!chat.isGroup || !isAllowedGroup(chat.name, GROUPS)) return;
    if (!isRelevant(msg.body)) return;
    if (!(await isFromAdmin(msg, chat))) return;
    await send(toIngestPayload({ id: msg.id._serialized, group: chat.name, body: msg.body, timestamp: msg.timestamp }));
  } catch (e) {
    console.error("Message handling failed:", e.message);
  }
});

client.initialize();
