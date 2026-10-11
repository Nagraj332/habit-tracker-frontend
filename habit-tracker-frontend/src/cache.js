// Keeps the last habit list on the device, so the home page can show it instantly
// while the server (which may be waking up) answers in the background.
import { fmt } from "./api";

const KEY = "habit-cache-v1";

export function readHabitCache() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!c || !Array.isArray(c.habits)) return null;
    // a list saved on an earlier day can't know today's check-ins yet
    return c.day === fmt(new Date()) ? c.habits : c.habits.map((h) => ({ ...h, completedToday: false }));
  } catch {
    return null;
  }
}

export function writeHabitCache(habits) {
  try { localStorage.setItem(KEY, JSON.stringify({ day: fmt(new Date()), habits })); } catch { /* ignore */ }
}
