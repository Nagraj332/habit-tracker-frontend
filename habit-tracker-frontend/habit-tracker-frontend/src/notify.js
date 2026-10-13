// Notifications in the browser. (The Android app plans its own notifications, see native.js.)
export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;
export const notificationsGranted = () => notifySupported() && Notification.permission === "granted";

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported (iPhones) */ }
}

/** Shows a notification through the service worker when there is one, otherwise directly. */
export async function notify(title, body, tag) {
  if (!notificationsGranted()) return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" });
      return;
    }
  } catch { /* fall back below */ }
  try {
    const n = new Notification(title, { body, tag });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* some browsers only allow notifications from a service worker */ }
}
