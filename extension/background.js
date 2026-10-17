// Campus Daily Connect — watches only Moodle's app-login page (launch.php). When Moodle redirects to
// moodlemobile://token=…, the app key is sent to Campus Daily together with the one-time passport
// Campus Daily created for you. Nothing else is read; your password never leaves IITB's SSO page.
const APP = "https://campusdaily.nexuspulsetech.com";
const FILTER = { urls: ["https://moodle.iitb.ac.in/admin/tool/mobile/launch.php*"] };
const done = new Set(); // passports already sent (both listeners may fire)

async function send(requestUrl, redirect, tabId) {
  if (!redirect || !redirect.startsWith("moodlemobile://")) return;
  const passport = new URL(requestUrl).searchParams.get("passport") || "";
  if (!passport || done.has(passport)) return;
  done.add(passport);
  let msg = "Moodle connected ✓";
  try {
    const res = await fetch(`${APP}/api/moodle/extension-connect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passport, redirect }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) msg = j.error || "Couldn't connect";
  } catch {
    msg = "Couldn't reach Campus Daily";
  }
  if (tabId >= 0) chrome.tabs.update(tabId, { url: `${APP}/settings?moodle=${encodeURIComponent(msg)}#moodle` });
}

// The redirect's Location header (works even when Chrome won't follow an app link).
chrome.webRequest.onHeadersReceived.addListener(
  (d) => {
    const loc = (d.responseHeaders || []).find((h) => h.name.toLowerCase() === "location");
    if (loc && loc.value) send(d.url, loc.value, d.tabId);
  },
  FILTER,
  ["responseHeaders", "extraHeaders"]
);
chrome.webRequest.onBeforeRedirect.addListener((d) => send(d.url, d.redirectUrl, d.tabId), FILTER);

// ---- ResoBin timetable import (only when Campus Daily asks, with a one-time passport) ----
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== "resobin-import") return;
  const from = sender.origin || (sender.url ? new URL(sender.url).origin : "");
  if (from !== APP && from !== "http://localhost:3000") return reply({ ok: false, error: "Not from Campus Daily." });
  (async () => {
    const sem = /^[a-z]+-\d{4}$/.test(msg.semester) ? msg.semester : "autumn-2026";
    let rows;
    try {
      const r = await fetch(`https://resobin.gymkhana.iitb.ac.in/api/accounts/profile/semester/${sem}/timetable`, { credentials: "include" });
      if (r.status === 401 || r.status === 403) return reply({ ok: false, needSignIn: true, error: "Sign in to ResoBin in this browser first, then try again." });
      if (!r.ok) return reply({ ok: false, error: `ResoBin answered ${r.status}.` });
      rows = await r.json();
    } catch {
      return reply({ ok: false, error: "Couldn't reach ResoBin." });
    }
    try {
      const res = await fetch(`${APP}/api/resobin/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passport: msg.passport, timetable: rows }),
      });
      const j = await res.json().catch(() => ({}));
      reply(res.ok ? { ok: true, count: j.count } : { ok: false, error: j.error || "Campus Daily couldn't save it." });
    } catch {
      reply({ ok: false, error: "Couldn't reach Campus Daily." });
    }
  })();
  return true; // async reply
});
