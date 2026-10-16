/**
 * Campus Daily WhatsApp bridge — runs on your PC.
 *
 * What it reads:
 *  - Every group with MIN_MEMBERS+ members (default 50): hostel, batch, department, clubs, courses…
 *  - plus any groups named in GROUPS, minus names matching EXCLUDE (family, organiser teams…).
 *  - Only posts by group ADMINS (ADMINS_ONLY=true), so ordinary members' chat is never shared.
 *
 * Safety & privacy:
 *  - Read-only: never sends messages, never marks chats as read.
 *  - Shares only the group name + message text — never author names or numbers.
 *  - Stores no message content on disk (state.json keeps only timestamps per group).
 *
 * Missed messages: when the PC wakes up or the bridge restarts, it re-reads each watched group
 * since the last message it handled (and every 20 minutes as a safety net).
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
import { toIngestPayload, isRelevant, parseGroups, isAllowedGroup, shouldWatch } from "./lib.mjs";

const { Client, LocalAuth } = pkg;

const INGEST_URL = process.env.INGEST_URL || "https://campusdaily.nexuspulsetech.com/api/ingest/email";
const HEARTBEAT_URL = INGEST_URL.replace(/\/api\/ingest\/email$/, "/api/ingest/heartbeat");
const SECRET = process.env.INGEST_SECRET_KEY;
const GROUPS = parseGroups(process.env.GROUPS);
const MIN_MEMBERS = Number(process.env.MIN_MEMBERS || 50);
const EXCLUDE = new RegExp(process.env.EXCLUDE || "family|orgies|organi[sz]|\\bcore\\b|\\bteam\\b|committee", "i");
const ADMINS_ONLY = (process.env.ADMINS_ONLY || "true").toLowerCase() !== "false";
const STATE_FILE = "state.json";
const FIRST_RUN_LOOKBACK_S = 12 * 3600;

if (!SECRET) {
  console.error("Set INGEST_SECRET_KEY in whatsapp-bridge/.env first.");
  process.exit(1);
}

// ---------- state (timestamps only) ----------
let state = { lastTs: {} };
try {
  if (existsSync(STATE_FILE)) state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
} catch {}
const saveState = () => {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch {}
};

const stats = { day: new Date().toDateString(), seenToday: 0, forwardedToday: 0, caughtUp: 0, startedAt: new Date().toISOString(), lastMessageAt: null };
const rollDay = () => {
  if (stats.day !== new Date().toDateString()) Object.assign(stats, { day: new Date().toDateString(), seenToday: 0, forwardedToday: 0, caughtUp: 0 });
};
const handledIds = new Set();

// ---------- browser ----------
const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);
const executablePath = BROWSER_CANDIDATES.find((p) => existsSync(p));

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
  puppeteer: { headless: true, executablePath, timeout: 120000, args: ["--no-first-run", "--disable-extensions"] },
});

/** chatId -> group name, for groups we read. */
let watched = new Map();

async function refreshWatched() {
  const chats = await client.getChats().catch((e) => (console.error("getChats failed:", e?.message || e), []));
  const next = new Map();
  for (const c of chats) {
    if (!c.isGroup) continue;
    const members = c.participants?.length || c.groupMetadata?.participants?.length || 0;
    if (shouldWatch({ name: c.name, members }, { minMembers: MIN_MEMBERS, include: GROUPS, exclude: EXCLUDE })) next.set(c.id._serialized, c.name);
  }
  watched = next;
  console.log(`Watching ${watched.size} group(s) (${MIN_MEMBERS}+ members${GROUPS.length ? " + listed" : ""}, admins only: ${ADMINS_ONLY}).`);
}

// ---------- sending ----------
async function send(payload, attempt = 1) {
  try {
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ingest-secret": SECRET },
      body: JSON.stringify(payload),
    });
    if (res.ok || res.status === 422 || res.status === 400) {
      rollDay();
      stats.forwardedToday++;
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

async function handle(msg, chat) {
  const id = msg.id?._serialized;
  if (!id || handledIds.has(id)) return;
  handledIds.add(id);
  if (handledIds.size > 5000) handledIds.delete(handledIds.values().next().value);
  rollDay();
  stats.seenToday++;
  stats.lastMessageAt = new Date((msg.timestamp || Date.now() / 1000) * 1000).toISOString();
  const key = chat.id._serialized;
  state.lastTs[key] = Math.max(state.lastTs[key] || 0, msg.timestamp || 0);
  if (!isRelevant(msg.body)) return;
  if (!(await isFromAdmin(msg, chat))) return;
  await send(toIngestPayload({ id, group: chat.name, body: msg.body, timestamp: msg.timestamp }));
}

/** Re-read each watched group since the last handled message (covers sleep / restarts). */
let catchingUp = false;
async function catchUp(reason) {
  if (catchingUp) return;
  catchingUp = true;
  let n = 0;
  try {
    const now = Math.floor(Date.now() / 1000);
    for (const [chatId] of watched) {
      const chat = await client.getChatById(chatId).catch(() => null);
      if (!chat) continue;
      const since = state.lastTs[chatId] || now - FIRST_RUN_LOOKBACK_S;
      const msgs = await chat.fetchMessages({ limit: 80 }).catch(() => []);
      for (const m of msgs.filter((m) => (m.timestamp || 0) > since && !m.fromMe).sort((a, b) => a.timestamp - b.timestamp)) {
        await handle(m, chat);
        n++;
      }
      if (!state.lastTs[chatId]) state.lastTs[chatId] = now;
    }
  } finally {
    catchingUp = false;
    saveState();
  }
  rollDay();
  stats.caughtUp += n;
  if (n) console.log(`Caught up ${n} message(s) (${reason}).`);
}

async function heartbeat() {
  rollDay();
  try {
    await fetch(HEARTBEAT_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ingest-secret": SECRET },
      body: JSON.stringify({ ...stats, groups: [...watched.values()] }),
    });
  } catch {}
  console.log(`${new Date().toLocaleTimeString()} · ${watched.size} groups · ${stats.seenToday} messages read today · ${stats.forwardedToday} sent to Campus Daily`);
}

// ---------- wiring ----------
client.on("qr", (qr) => {
  console.log("\nScan with your phone: WhatsApp > Settings > Linked devices > Link a device\n");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  await refreshWatched();
  await catchUp("start");
  await heartbeat();
});

client.on("change_state", async (s) => {
  if (s === "CONNECTED") await catchUp("reconnected");
});

client.on("disconnected", (r) => {
  console.error("Disconnected:", r, "— restarting in 60s");
  setTimeout(() => client.initialize(), 60000);
});

client.on("message", async (msg) => {
  try {
    const chat = await msg.getChat();
    if (!chat.isGroup || !watched.has(chat.id._serialized)) return;
    await handle(msg, chat);
    saveState();
  } catch (e) {
    console.error("Message handling failed:", e?.message || e);
  }
});

// Detect laptop sleep: if a 1-minute timer fires much later, we were asleep — catch up.
let lastTick = Date.now();
setInterval(() => {
  const gap = Date.now() - lastTick;
  lastTick = Date.now();
  if (gap > 3 * 60_000 && watched.size) catchUp(`woke after ${Math.round(gap / 60000)} min`);
}, 60_000);

setInterval(() => watched.size && catchUp("periodic"), 20 * 60_000);
setInterval(heartbeat, 10 * 60_000);
setInterval(refreshWatched, 6 * 3600_000);

client.initialize();
