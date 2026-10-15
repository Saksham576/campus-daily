/**
 * Campus Daily WhatsApp bridge — runs on your PC.
 * Reads ONLY the WhatsApp groups listed in GROUPS (in .env) on a SPARE number
 * and sends each substantive message to Campus Daily's ingest API.
 *
 * Uses whatsapp-web.js (unofficial). Automated WhatsApp use breaks WhatsApp's
 * terms and the number can be banned — never use your main number.
 *
 *   cd whatsapp-bridge
 *   npm install
 *   copy .env.example .env   (then fill it in)
 *   npm start                (scan the QR code once with the spare phone)
 */
import "dotenv/config";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
import { toIngestPayload, isRelevant } from "./lib.mjs";

const { Client, LocalAuth } = pkg;

const INGEST_URL = process.env.INGEST_URL || "https://campusdaily.nexuspulsetech.com/api/ingest/email";
const SECRET = process.env.INGEST_SECRET_KEY;
const GROUPS = (process.env.GROUPS || "")
  .split("|")
  .map((g) => g.trim().toLowerCase())
  .filter(Boolean);

if (!SECRET || GROUPS.length === 0) {
  console.error("Set INGEST_SECRET_KEY and GROUPS in whatsapp-bridge/.env first.");
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
  puppeteer: { headless: true, args: ["--no-sandbox"] },
});

client.on("qr", (qr) => {
  console.log("Scan this QR with the SPARE phone: WhatsApp > Linked devices > Link a device");
  qrcode.generate(qr, { small: true });
});
client.on("ready", () => console.log(`Bridge ready. Watching ${GROUPS.length} group(s).`));
client.on("disconnected", (r) => {
  console.error("Disconnected:", r, "— restarting in 30s");
  setTimeout(() => client.initialize(), 30000);
});

async function send(payload, attempt = 1) {
  try {
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ingest-secret": SECRET },
      body: JSON.stringify(payload),
    });
    if (res.ok || res.status === 422) {
      const j = await res.json().catch(() => ({}));
      console.log(`→ sent "${payload.subject}" score=${j.score ?? "-"} timetable=${j.timetable_update ?? "-"}`);
      return;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    if (attempt >= 5) return console.error("Giving up on message:", payload.subject, e.message);
    setTimeout(() => send(payload, attempt + 1), attempt * 60000);
  }
}

client.on("message", async (msg) => {
  try {
    const chat = await msg.getChat();
    if (!chat.isGroup || !GROUPS.includes(chat.name.trim().toLowerCase())) return;
    if (!isRelevant(msg.body)) return;
    const contact = await msg.getContact().catch(() => null);
    await send(
      toIngestPayload({
        id: msg.id._serialized,
        group: chat.name,
        author: contact?.pushname || contact?.name || "member",
        body: msg.body,
        timestamp: msg.timestamp,
      })
    );
  } catch (e) {
    console.error("Message handling failed:", e.message);
  }
});

client.initialize();
