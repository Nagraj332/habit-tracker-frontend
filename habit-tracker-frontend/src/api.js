import axios from "axios";

const OWNER_KEY = "habit-owner-id";
let memoryOwner = null; // fallback if localStorage is blocked

/** A random id that identifies this browser. Created once and kept in localStorage. */
function newId() {
  const c = window.crypto;
  if (c?.randomUUID) return c.randomUUID(); // only exists on https / localhost
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function getOwnerId() {
  try {
    let id = localStorage.getItem(OWNER_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(OWNER_KEY, id);
    }
    return id;
  } catch {
    return (memoryOwner ||= newId());
  }
}

/** Use another device's code so both devices show the same habits. Returns false if the code is not valid. */
export function setOwnerId(raw) {
  const id = String(raw || "").trim();
  if (!/^[A-Za-z0-9-]{16,64}$/.test(id)) return false;
  try {
    localStorage.setItem(OWNER_KEY, id);
    localStorage.removeItem("habit-cache-v1"); // the saved copy belongs to the old code
  } catch {
    memoryOwner = id;
  }
  return true;
}

export const API_BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8080/api`;

const http = axios.create({ baseURL: API_BASE });

// every request carries this browser's owner id, so each browser only sees its own data
http.interceptors.request.use((config) => {
  config.headers["X-Owner-Id"] = getOwnerId();
  return config;
});

export const api = {
  list: () => http.get("/habits").then((r) => r.data),
  create: (body) => http.post("/habits", body).then((r) => r.data),
  update: (id, body) => http.put(`/habits/${id}`, body).then((r) => r.data),
  remove: (id) => http.delete(`/habits/${id}`),
  toggle: (id, date) =>
    http.post(`/habits/${id}/toggle`, null, { params: { date } }).then((r) => r.data),
  logs: (id, from, to) =>
    http.get(`/habits/${id}/logs`, { params: { from, to } }).then((r) => r.data),
  stats: (id) => http.get(`/habits/${id}/stats`).then((r) => r.data),
  walks: () => http.get("/walks").then((r) => r.data),
  createWalk: (body) => http.post("/walks", body).then((r) => r.data),
  removeWalk: (id) => http.delete(`/walks/${id}`),

  // alarm notifications that work when the app is closed
  pushKey: () => http.get("/push/key").then((r) => r.data),
  pushSubscribe: (body) => http.post("/push/subscribe", body),
  pushUnsubscribe: (endpoint) => http.post("/push/unsubscribe", { endpoint }),
  pushTest: () => http.post("/push/test").then((r) => r.data),
  pushStatus: () => http.get("/push/status", { params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }).then((r) => r.data),
  /** Ids of habits whose alarm has rung on the server and is still waiting for you. */
  pushRinging: () => http.get("/push/ringing", { params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }).then((r) => r.data),
  /** Tell the server an alarm was handled in the app: stop it, or ring again after `snoozeMinutes`. */
  pushAck: (habitId, snoozeMinutes) =>
    http.post("/push/ack", { habitId, snoozeMinutes: snoozeMinutes || null, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
};

/** Local date -> "yyyy-MM-dd" (avoids the UTC shift of toISOString). */
export const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const errMsg = (e) =>
  e.response?.data?.errors
    ? Object.values(e.response.data.errors).join(", ")
    : e.response?.data?.message ||
      "Can't reach the server. Check that the backend is running on port 8080.";

/** Is this habit due on the given day ("yyyy-MM-dd")? Daily habits run from their start date, others only on chosen dates. */
export const isActiveOn = (h, key) => (h.scheduledDates?.length ? h.scheduledDates.includes(key) : h.createdDate <= key);

/** The next day after today the habit is due, or null. */
export const nextDate = (h, todayKey) =>
  h.scheduledDates?.length ? h.scheduledDates.find((d) => d > todayKey) || null : h.createdDate > todayKey ? h.createdDate : null;

export const shortDate = (key) => new Date(key + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
