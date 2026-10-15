/* Campus Daily service worker: offline timetable + feed, and push alerts. */
const VERSION = "cd-v1";
const PAGES = "pages-" + VERSION;
const DATA = "data-" + VERSION;
const STATIC = "static-" + VERSION;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreVary: true });
    if (hit) return hit;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pages students need in lecture halls with no signal
  if (req.mode === "navigate" && url.origin === self.location.origin && (url.pathname === "/" || url.pathname === "/schedule")) {
    event.respondWith(
      networkFirst(req, PAGES).catch(
        () => new Response("<h1>Offline</h1><p>Open Campus Daily once while online to save your timetable.</p>", { headers: { "content-type": "text/html" } })
      )
    );
    return;
  }

  // App code and styles
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => (c.put(req, res.clone()), res))))
    );
    return;
  }

  // Timetable data and session check from Supabase (read-only GETs)
  if (url.hostname.endsWith(".supabase.co") && (url.pathname.startsWith("/rest/v1/") || url.pathname === "/auth/v1/user")) {
    event.respondWith(networkFirst(req, DATA));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || "Campus Daily", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((wins) => {
      for (const w of wins) if ("focus" in w) return w.navigate(url).then((c) => c && c.focus());
      return self.clients.openWindow(url);
    })
  );
});
