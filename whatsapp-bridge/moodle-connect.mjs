/**
 * Campus Daily — Connect Moodle (run on your PC, once).
 *
 * IITB Moodle only allows app logins through the IIT Bombay SSO page in a real browser, and
 * the "Security keys" page is disabled for students. This helper does exactly what the official
 * Moodle app does:
 *   1. opens a normal Chrome window on Moodle's app-login page,
 *   2. you sign in with IIT Bombay SSO yourself (your password stays on IITB's page),
 *   3. Moodle hands back the app key, which this helper sends straight to Campus Daily.
 *
 *   node moodle-connect.mjs        (or double-click "Connect Moodle.cmd")
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";
import { tokenFromLaunchRedirect } from "./lib.mjs";

const MOODLE = "https://moodle.iitb.ac.in";
const APP_URL = (process.env.INGEST_URL || "https://campusdaily.nexuspulsetech.com/api/ingest/email").replace(/\/api\/ingest\/email$/, "");
const SECRET = process.env.INGEST_SECRET_KEY;
const EMAIL = (process.env.STUDENT_EMAIL || "").trim().toLowerCase();

if (!SECRET || !EMAIL) {
  console.error("Set INGEST_SECRET_KEY and STUDENT_EMAIL (your @iitb.ac.in email) in whatsapp-bridge/.env first.");
  process.exit(1);
}

const executablePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => p && existsSync(p));

const passport = randomBytes(8).toString("hex");
const launch = `${MOODLE}/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=${passport}&urlscheme=moodlemobile`;

console.log("Opening Moodle… sign in with IIT Bombay SSO in the window that appears.");
const browser = await puppeteer.launch({
  headless: false,
  executablePath,
  userDataDir: ".moodle_profile",
  defaultViewport: null,
  args: ["--no-first-run", "--window-size=520,760"],
});
const [page] = await browser.pages();
await page.bringToFront().catch(() => {});
console.log("A small Chrome window with the Moodle sign-in page is open. If you don't see it, check the taskbar.");
console.log("Waiting up to 20 minutes for you to sign in…");

const token = await new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), 20 * 60_000);
  page.on("response", (res) => {
    const loc = res.headers()["location"] || "";
    if (res.url().includes("/admin/tool/mobile/launch.php") && loc.startsWith("moodlemobile://")) {
      clearTimeout(timer);
      const t = tokenFromLaunchRedirect(loc, MOODLE, passport);
      if (!t) console.error("Moodle answered, but the key failed its check.");
      resolve(t);
    }
  });
  browser.on("disconnected", () => resolve(null));
  page.goto(launch).catch(() => {});
});

await browser.close().catch(() => {});
if (!token) {
  console.error("No Moodle key received (window closed, sign-in not finished, or 20 minutes passed). Run it again.");
  process.exit(1);
}

const res = await fetch(`${APP_URL}/api/moodle/agent-connect`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-ingest-secret": SECRET },
  body: JSON.stringify({ email: EMAIL, key: token }),
});
const j = await res.json().catch(() => ({}));
if (res.ok) console.log(`✓ Moodle connected for ${EMAIL} (${j.name}). Campus Daily reads your courses every 30 minutes.`);
else console.error("Campus Daily couldn't save it:", j.error || res.status);
