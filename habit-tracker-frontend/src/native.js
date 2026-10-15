// Alarms for the Android app. They are scheduled on the phone itself (Android's alarm clock service),
// so they go off at the right minute with the app closed, removed from recents, or the phone asleep.
// In a normal browser every function here does nothing.
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { fmt, isActiveOn } from "./api";

export const isNative = () => Capacitor.isNativePlatform();

const CHANNEL = "habit-alarm";
export const RING_MINUTES = 12; // each alarm rings once a minute for this many minutes unless you stop it
const FIRST_DAYS = 14; // days ahead that get the first ring (so alarms keep working if you don't open the app)
const REPEAT_DAYS = 2; // days ahead that also get the repeat rings
const MAX_ALARMS = 450; // Android allows about 500 scheduled alarms per app
const SNOOZE_DAY = 9000; // ids with a "day" at or above this are snoozes
const EPOCH = new Date(2026, 0, 1);

// A notification id carries the habit, the day and the ring number, so alarms can be found without looking them up.
const dayIndex = (d) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000);
const makeId = (habitId, day, k) => (Number(habitId) % 2000) * 1000000 + day * 100 + k;
const decode = (id) => ({ slot: Math.floor(id / 1000000), day: Math.floor((id % 1000000) / 100), k: id % 100 });
const parseKey = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };

// ----- "you've seen this one today": stops further rings for that habit and day -----
const SILENCE_KEY = "habit-silenced";
function silenced() {
  try {
    const today = fmt(new Date());
    return new Set(JSON.parse(localStorage.getItem(SILENCE_KEY) || "[]").filter((k) => k.slice(0, 10) >= today));
  } catch {
    return new Set();
  }
}
const silenceKey = (habitId, dateKey) => `${dateKey}|${habitId}`;

async function pending() {
  try {
    return (await LocalNotifications.getPending()).notifications || [];
  } catch {
    return [];
  }
}

async function cancelIds(ids) {
  if (ids.length) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => {});
}

/** Call once when the app starts. */
export async function setupNative() {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL,
      name: "Habit alarms",
      description: "Alarms for your habit reminders",
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch { /* the channel may already exist */ }
  try {
    // Android 13+ asks once; later launches don't ask again
    if ((await LocalNotifications.checkPermissions()).display === "prompt") await LocalNotifications.requestPermissions();
  } catch { /* ignore */ }
}

export async function getNativeStatus() {
  if (!isNative()) return null;
  let notifications = "unknown";
  let exact = "granted";
  try { notifications = (await LocalNotifications.checkPermissions()).display; } catch { /* ignore */ }
  try {
    const r = await LocalNotifications.checkExactNotificationSetting();
    exact = r.exact_alarm ?? r.exactAlarm ?? "granted";
  } catch { /* older Android versions have no such setting */ }
  return { notifications, exact, scheduled: (await pending()).length };
}

export async function requestNativePermission() {
  try {
    return (await LocalNotifications.requestPermissions()).display;
  } catch {
    return "denied";
  }
}

export const openExactAlarmSettings = () => LocalNotifications.changeExactNotificationSetting().catch(() => {});

/** Re-plans every alarm from the current habits. Safe to call as often as you like. */
export async function scheduleAll(habits) {
  if (!isNative()) return 0;
  let granted = false;
  try { granted = (await LocalNotifications.checkPermissions()).display === "granted"; } catch { /* ignore */ }
  if (!granted) return 0;

  const now = new Date();
  const quiet = silenced();
  const done = new Set(habits.filter((h) => h.completedToday).map((h) => Number(h.id) % 2000));

  // clear the old plan; snoozes stay unless that habit has been done
  const old = await pending();
  await cancelIds(old.filter((n) => {
    const d = decode(n.id);
    return d.day < SNOOZE_DAY || done.has(d.slot);
  }).map((n) => n.id));

  const list = [];
  for (const h of habits) {
    if (!h.reminderTime) continue;
    const [hh, mm] = h.reminderTime.split(":").map(Number);
    for (let i = 0; i < FIRST_DAYS; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = fmt(d);
      if (!isActiveOn(h, key)) continue;
      if (i === 0 && h.completedToday) continue;
      if (quiet.has(silenceKey(h.id, key))) continue;
      const rings = i < REPEAT_DAYS ? RING_MINUTES : 1;
      for (let k = 0; k < rings; k++) {
        const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm + k, 0);
        if (at <= now) continue;
        list.push({
          at,
          n: {
            id: makeId(h.id, dayIndex(d), k),
            title: `Time for ${h.name}`,
            body: k === 0 ? (h.description || "Tap to mark it done.") : "Still waiting. Tap to mark it done or stop the alarm.",
            schedule: { at, allowWhileIdle: true },
            channelId: CHANNEL,
            autoCancel: true,
            extra: { habitId: h.id, date: key },
          },
        });
      }
    }
  }
  list.sort((a, b) => a.at - b.at);
  const batch = list.slice(0, MAX_ALARMS).map((x) => x.n);
  if (batch.length) await LocalNotifications.schedule({ notifications: batch }).catch(() => {});
  return batch.length;
}

/** You have seen today's alarm for this habit: cancel its remaining rings and don't plan them again. */
export async function silenceHabitDay(habitId, dateKey) {
  if (!isNative()) return;
  try {
    const set = silenced();
    set.add(silenceKey(habitId, dateKey));
    localStorage.setItem(SILENCE_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
  const slot = Number(habitId) % 2000;
  const day = dayIndex(parseKey(dateKey));
  const mine = (n) => {
    const d = decode(n.id);
    return d.slot === slot && d.day === day;
  };
  await cancelIds((await pending()).filter(mine).map((n) => n.id));
  // also clear this habit's alarm notifications that are already showing in the notification shade
  try {
    const shown = (await LocalNotifications.getDeliveredNotifications()).notifications || [];
    const ids = shown.filter(mine).map((n) => ({ id: n.id }));
    if (ids.length) await LocalNotifications.removeDeliveredNotifications({ notifications: ids });
  } catch { /* ignore */ }
}

/** One alarm again after the snooze time. */
export async function scheduleSnooze(habit, minutes) {
  if (!isNative()) return;
  const at = new Date(Date.now() + minutes * 60000);
  const day = SNOOZE_DAY + (Math.floor(Date.now() / 60000) % 900);
  await LocalNotifications.schedule({
    notifications: [{
      id: makeId(habit.id, day, 0),
      title: `Time for ${habit.name}`,
      body: "Snooze is over. Tap to mark it done.",
      schedule: { at, allowWhileIdle: true },
      channelId: CHANNEL,
      autoCancel: true,
      extra: { habitId: habit.id, date: fmt(new Date()) },
    }],
  }).catch(() => {});
}

/** Runs the callback with the habit id when you tap an alarm notification. Returns a handle with remove(). */
export function onNotificationTap(callback) {
  return LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const extra = event?.notification?.extra;
    if (extra?.habitId != null) callback(extra.habitId);
  });
}
