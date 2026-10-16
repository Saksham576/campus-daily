// Campus Daily Connect — watches only Moodle's app-login page (launch.php). When Moodle redirects to
// moodlemobile://token=…, the app key is sent to Campus Daily together with the one-time passport
// Campus Daily created for you. Nothing else is read; your password never leaves IITB's SSO page.
const APP = "https://campusdaily.nexuspulsetech.com";

chrome.webRequest.onBeforeRedirect.addListener(
  async (d) => {
    if (!d.redirectUrl || !d.redirectUrl.startsWith("moodlemobile://")) return;
    const passport = new URL(d.url).searchParams.get("passport") || "";
    let msg = "Moodle connected ✓";
    try {
      const res = await fetch(`${APP}/api/moodle/extension-connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passport, redirect: d.redirectUrl }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) msg = j.error || "Couldn't connect";
    } catch {
      msg = "Couldn't reach Campus Daily";
    }
    if (d.tabId >= 0) chrome.tabs.update(d.tabId, { url: `${APP}/settings?moodle=${encodeURIComponent(msg)}#moodle` });
  },
  { urls: ["https://moodle.iitb.ac.in/admin/tool/mobile/launch.php*"] }
);
