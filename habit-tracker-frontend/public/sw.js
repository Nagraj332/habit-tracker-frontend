// Service worker: installable app, offline app shell, update flow and alarm notifications.
// "__BUILD_ID__" is replaced with a new value on every build, so each deploy is detected as an update.
const VERSION = "habit-tracker-__BUILD_ID__";
const CONFIG_CACHE = "habit-config"; // the page stores the API address + owner id here for notification buttons
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  // No skipWaiting here: the page shows "New version available" and asks for it (see the message handler).
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("habit-tracker-") && k !== VERSION).map((k) => caches.delete(k))))
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

// ---------- alarm notifications (sent by the server, so they work when the app is closed) ----------

const pad = (n) => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const isApple = () => /iPhone|iPad|iPod|Macintosh/.test(self.navigator.userAgent);

async function readConfig() {
  try {
    const hit = await (await caches.open(CONFIG_CACHE)).match("/__config");
    return hit ? await hit.json() : null;
  } catch {
    return null;
  }
}

async function callApi(path, body) {
  const cfg = await readConfig();
  if (!cfg?.apiBase || !cfg?.ownerId) return false;
  try {
    const res = await fetch(cfg.apiBase + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Owner-Id": cfg.ownerId },
      body: JSON.stringify({ ...body, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { /* ignore */ }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visible = wins.some((w) => w.visibilityState === "visible");
    // the open app already rings by itself; Chrome allows skipping the notification then, Apple devices do not
    if (visible && d.type !== "test" && !isApple()) return;
    const isAlarm = d.type === "habit";
    await self.registration.showNotification(d.title || "Habit reminder", {
      body: d.body || "",
      tag: d.tag || "habit",
      renotify: true, // ring again every time the server repeats the alarm
      requireInteraction: isAlarm, // stays on screen until you act on it
      silent: visible, // never beep over an app you are looking at
      vibrate: isAlarm ? [500, 200, 500, 200, 800] : [300, 150, 300],
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { habitId: d.habitId, tag: d.tag, type: d.type },
      actions: isAlarm ? [{ action: "done", title: "Mark done" }, { action: "stop", title: "Stop alarm" }] : [],
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  const n = e.notification;
  const d = n.data || {};
  n.close();
  e.waitUntil((async () => {
    if (d.type === "habit" && d.habitId) {
      if (e.action === "done") { await callApi("/push/done", { habitId: d.habitId, date: today() }); return; }
      await callApi("/push/ack", { habitId: d.habitId }); // tapping the alarm or "Stop alarm" silences it
      if (e.action === "stop") return;
    }
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (list[0]) return list[0].focus();
    return self.clients.openWindow("/");
  })());
});

// swiped away = the user wants it to stop (but a repeat replacing it must not count as a dismissal)
self.addEventListener("notificationclose", (e) => {
  const d = e.notification.data || {};
  if (d.type !== "habit" || !d.habitId) return;
  e.waitUntil((async () => {
    const same = await self.registration.getNotifications({ tag: d.tag });
    if (same.length === 0) await callApi("/push/ack", { habitId: d.habitId });
  })());
});
