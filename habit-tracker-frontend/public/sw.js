// Service worker: installable app, offline app shell, update flow and alarm notifications.
// "__BUILD_ID__" is replaced with a new value on every build, so each deploy is detected as an update.
const VERSION = "habit-tracker-__BUILD_ID__";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  // No skipWaiting here: the page shows "New version available" and asks for it (see the message handler).
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// alarms were removed: forget any push subscription an earlier version made on this device
async function dropPush() {
  try {
    const sub = await self.registration.pushManager?.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch { /* ignore */ }
}

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith("habit-tracker-") && k !== VERSION) || k === "habit-config").map((k) => caches.delete(k))))
      .then(dropPush)
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // page loads: network first, fall back to the cached app shell when offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // scripts, styles, icons: serve from cache, refresh in the background
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
