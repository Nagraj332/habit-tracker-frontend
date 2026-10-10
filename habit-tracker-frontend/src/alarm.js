// Alarm sound (custom tune from the user's files, or a built-in beep) + browser notifications.
const DB = "habit-tracker";
const STORE = "tune";

const openDb = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const run = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
};

export const saveTune = (file) => run("readwrite", (s) => s.put({ blob: file, name: file.name }, "tune"));
export const loadTune = () => run("readonly", (s) => s.get("tune"));
export const clearTune = () => run("readwrite", (s) => s.delete("tune"));

// ----- vibration (Android Chrome; iPhone browsers don't support it) -----
const PATTERN = [600, 250, 600, 250, 900];
export const vibrationSupported = () => typeof navigator !== "undefined" && "vibrate" in navigator;
export function vibrate(pattern) {
  if (vibrationSupported()) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}
let vibeTimer = null;
let vibeStop = null;
function stopVibration() {
  clearInterval(vibeTimer);
  clearTimeout(vibeStop);
  vibeTimer = vibeStop = null;
  vibrate(0);
}
function startVibration(maxMs) {
  stopVibration();
  vibrate(PATTERN);
  vibeTimer = setInterval(() => vibrate(PATTERN), 3200);
  vibeStop = setTimeout(stopVibration, maxMs);
}

// ----- audio unlock (phones only allow sound after the user has tapped the page) -----
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let sharedCtx = null;
let sharedAudio = null;
let audioUnlocked = false;

function getCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new Ctx();
  return sharedCtx;
}

/** Call from a user tap: resumes the shared audio context and unlocks the shared <audio> element. */
export function unlockAudio() {
  try {
    const ctx = getCtx();
    if (ctx) {
      ctx.resume?.();
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination);
      s.start(0);
    }
    if (!audioUnlocked && !current) {
      if (!sharedAudio) sharedAudio = new Audio();
      sharedAudio.src = SILENT_WAV;
      sharedAudio.muted = true;
      sharedAudio.play()
        .then(() => { sharedAudio.pause(); sharedAudio.muted = false; audioUnlocked = true; })
        .catch(() => {});
    }
  } catch { /* ignore */ }
}

/** Call once at app start (main.jsx): unlocks audio on the first tap or key press. */
export function installAudioUnlock() {
  ["pointerdown", "touchend", "click", "keydown"].forEach((ev) =>
    window.addEventListener(ev, unlockAudio, { passive: true })
  );
}

let current = null;
let seq = 0;

export function stopAlarm() {
  seq++;
  current?.stop();
  current = null;
  stopVibration();
}

/** Starts ringing. Resolves { blocked: true } if the browser refused to play sound. */
export async function startAlarm({ volume = 0.8, maxMs = 60000, onStop, vibrate: shake = false } = {}) {
  stopAlarm();
  const mine = seq;
  if (shake) startVibration(maxMs);
  const cleanups = [];
  const finish = () => { cleanups.forEach((f) => f()); onStop?.(); };

  const tune = await loadTune().catch(() => null);
  if (mine !== seq) return { blocked: false };

  if (tune?.blob) {
    const url = URL.createObjectURL(tune.blob);
    const audio = sharedAudio || new Audio();
    audio.muted = false;
    audio.src = url;
    audio.loop = true;
    audio.volume = volume;
    cleanups.push(() => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    });
    try {
      await audio.play();
    } catch {
      finish();
      return { blocked: true };
    }
  } else {
    const ctx = getCtx();
    if (!ctx) {
      onStop?.();
      return { blocked: true };
    }
    await ctx.resume().catch(() => {});
    if (ctx.state !== "running") {
      onStop?.();
      return { blocked: true };
    }
    const beep = (delay) => {
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(volume * 0.6, t + 0.02);
      g.gain.linearRampToValueAtTime(0, t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.3);
    };
    const ring = () => { beep(0); beep(0.35); beep(0.7); };
    ring();
    const iv = setInterval(ring, 1600);
    cleanups.push(() => clearInterval(iv));
  }

  if (mine !== seq) { cleanups.forEach((f) => f()); return { blocked: false }; }
  const timer = setTimeout(stopAlarm, maxMs);
  current = { stop: () => { clearTimeout(timer); finish(); } };
  return { blocked: false };
}

export const notifySupported = () => "Notification" in window;

export async function notify(title, body, tag, vibrateOn = false) {
  if (!notifySupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag, requireInteraction: true, vibrate: vibrateOn ? [300, 150, 300, 150, 600] : undefined, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" });
      return;
    }
  } catch { /* fall back below */ }
  try {
    const n = new Notification(title, { body, tag, requireInteraction: true });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* some browsers only allow notifications from a service worker */ }
}
