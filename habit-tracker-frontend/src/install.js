// "Install app" support. The browser fires beforeinstallprompt once, early, so it is caught here
// (this file is imported first in main.jsx) and kept until the UI is ready to use it.
let event = null;
const listeners = new Set();
const tell = () => listeners.forEach((f) => f());

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  event = e;
  tell();
});
window.addEventListener("appinstalled", () => {
  event = null;
  try { localStorage.setItem("install-done", "1"); } catch { /* ignore */ }
  tell();
});

export const getInstallEvent = () => event;
export const subscribeInstall = (f) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Links opened inside WhatsApp, Instagram and similar apps can't install anything. */
export const inAppBrowser = () => {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|Instagram|Line\/|Snapchat|; wv\)/i.test(ua)) return true;
  return /iPhone|iPad|iPod/.test(ua) && !/Safari|CriOS|FxiOS|EdgiOS/.test(ua);
};

export async function runInstall() {
  if (!event) return false;
  const e = event;
  event = null;
  e.prompt();
  const choice = await e.userChoice;
  tell();
  return choice.outcome === "accepted";
}
