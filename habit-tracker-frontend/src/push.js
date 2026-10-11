// Alarm notifications that arrive even when the app is closed (Web Push).
import { API_BASE, api, getOwnerId } from "./api";
import { isIOS, isStandalone } from "./install";

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const toBytes = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** The active service worker registration. On a first visit it is still being set up, so wait for it (but not forever: the dev server never registers one). */
async function registration(waitMs = 8000) {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), waitMs))]);
}

/** The notification buttons run inside the service worker, which can't read localStorage, so give it what it needs. */
async function saveConfig() {
  try {
    const cache = await caches.open("habit-config");
    await cache.put("/__config", new Response(JSON.stringify({ apiBase: API_BASE, ownerId: getOwnerId() }), { headers: { "Content-Type": "application/json" } }));
  } catch { /* ignore */ }
}

/** "unsupported" | "needs-install" | "denied" | "off" | "on" */
export async function getPushStatus() {
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration(5000);
  if (!reg) return "unsupported";
  if (Notification.permission !== "granted") return "off";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** Asks for permission (must come from a tap) and registers this device with the server. */
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  try {
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "denied" };

    const reg = await registration();
    if (!reg) return { ok: false, reason: "unsupported" };

    const { publicKey } = await api.pushKey();
    const key = toBytes(publicKey);
    let sub = await reg.pushManager.getSubscription();
    if (sub?.options?.applicationServerKey && !sameBytes(new Uint8Array(sub.options.applicationServerKey), key)) {
      await sub.unsubscribe(); // made for a different server key
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

    await api.pushSubscribe({ ...sub.toJSON(), timezone: tz() });
    await saveConfig();
    try { localStorage.setItem("push-synced", String(Date.now())); } catch { /* ignore */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", message: e?.message || "Could not turn on alarm alerts." };
  }
}

/** Quietly keeps the server up to date (time zone, owner id) when alerts are already on. */
export async function syncPush() {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const last = Number(localStorage.getItem("push-synced") || 0);
    const reg = await registration(5000);
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    // still subscribed and synced recently: nothing to do. A lost subscription is re-created at once.
    if (sub && Date.now() - last < 6 * 3600 * 1000) { await saveConfig(); return; }
    await enablePush();
  } catch { /* ignore */ }
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.pushUnsubscribe(sub.endpoint).catch(() => {});
      await sub.unsubscribe();
    }
    localStorage.removeItem("push-synced");
  } catch { /* ignore */ }
}
