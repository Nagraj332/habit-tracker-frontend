// Reminder notifications for the Android app. They are planned on the phone itself, so they show at the
// reminder time even when the app is closed. In a normal browser every function here does nothing.
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { fmt, isActiveOn } from "./api";

export const isNative = () => Capacitor.isNativePlatform();

const CHANNEL = "habit-reminders";
const OLD_CHANNEL = "habit-alarm"; // left behind by the old alarm version of the app
const DAYS_AHEAD = 60; // days planned in advance, so reminders keep coming even if you don't open the app for weeks
const MAX_NOTIFICATIONS = 450; // Android allows about 500 planned notifications per app; the soonest ones are kept
const EXACT_ASKED_KEY = "habit-exact-asked";

let lastError = "";
/** The last problem the phone reported while planning reminders ("" when all is well). */
export const getPlanError = () => lastError;
const TEST_ID = 2000000001;
const EPOCH = new Date(2026, 0, 1);

// A notification id carries the habit and the day: (habit id % 2000) * 1,000,000 + days since 1 Jan 2026.
const dayIndex = (d) => Math.max(0, Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000));
const makeId = (habitId, day) => (Number(habitId) % 2000) * 1000000 + day;
const slotOf = (id) => Math.floor(id / 1000000);

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

// scheduleAll() waits for this, so reminders are never planned before the channel exists
let ready = Promise.resolve();

/** Call once when the app starts. */
export function setupNative() {
  ready = doSetup();
  return ready;
}

async function doSetup() {
  if (!isNative()) return;
  try { await LocalNotifications.deleteChannel({ id: OLD_CHANNEL }); } catch { /* it may not exist */ }
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL,
      name: "Habit reminders",
      description: "Reminders for habits you haven't done yet",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  } catch { /* the channel may already exist */ }
  try {
    // Android 13+ asks once; later launches don't ask again
    if ((await LocalNotifications.checkPermissions()).display === "prompt") await LocalNotifications.requestPermissions();
  } catch { /* ignore */ }
  try {
    // Android 14+ keeps "on-time delivery" off until you allow it. Without it reminders can come minutes late
    // or not at all while the phone is idle, so we open that screen once. The Reminders page can open it again.
    const allowed = (await LocalNotifications.checkPermissions()).display === "granted";
    const r = await LocalNotifications.checkExactNotificationSetting();
    const exact = r.exact_alarm ?? r.exactAlarm ?? "granted";
    if (allowed && exact !== "granted" && !localStorage.getItem(EXACT_ASKED_KEY)) {
      localStorage.setItem(EXACT_ASKED_KEY, "1");
      await LocalNotifications.changeExactNotificationSetting();
    }
  } catch { /* older Android versions have no such setting */ }
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
  let channelOff = false;
  try {
    const ch = (await LocalNotifications.listChannels()).channels?.find((c) => c.id === CHANNEL);
    channelOff = !!ch && ch.importance === 0; // 0 = switched off in Android's notification settings
  } catch { /* ignore */ }
  const planned = (await pending()).filter((n) => n.id !== TEST_ID).length;
  return { notifications, exact, channelOff, scheduled: planned, error: lastError };
}

/** Opens Android's "Alarms & reminders" screen, where the app can be allowed to notify exactly on time. */
export const openExactTimingSettings = () => LocalNotifications.changeExactNotificationSetting().catch(() => {});

export async function requestNativePermission() {
  try {
    return (await LocalNotifications.requestPermissions()).display;
  } catch {
    return "denied";
  }
}

// Plans run one after another, so two quick changes can never overwrite each other with an older list.
let queue = Promise.resolve();

/** Plans one notification per habit per day at its reminder time. Safe to call as often as you like. */
export function scheduleAll(habits) {
  queue = queue.then(() => plan(habits)).catch(() => 0);
  return queue;
}

async function plan(habits) {
  if (!isNative()) return 0;
  await ready;
  let granted = false;
  try { granted = (await LocalNotifications.checkPermissions()).display === "granted"; } catch { /* ignore */ }
  if (!granted) return 0;

  const now = new Date();

  // habits done today: take their reminder out of the notification shade
  const doneSlots = new Set(habits.filter((h) => h.completedToday).map((h) => Number(h.id) % 2000));
  try {
    const shown = (await LocalNotifications.getDeliveredNotifications()).notifications || [];
    const ids = shown.filter((n) => doneSlots.has(slotOf(n.id))).map((n) => ({ id: n.id }));
    if (ids.length) await LocalNotifications.removeDeliveredNotifications({ notifications: ids });
  } catch { /* ignore */ }

  const list = [];
  for (const h of habits) {
    if (!h.reminderTime) continue;
    const [hh, mm] = h.reminderTime.split(":").map(Number);
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = fmt(d);
      if (!isActiveOn(h, key)) continue;
      if (i === 0 && h.completedToday) continue;
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0);
      if (at <= now) continue;
      list.push({
        at,
        n: {
          id: makeId(h.id, dayIndex(d)),
          title: `Time for ${h.name}`,
          body: h.description || "You haven't done this one yet today.",
          schedule: { at, allowWhileIdle: true },
          channelId: CHANNEL,
          autoCancel: true,
          extra: { habitId: h.id, date: key },
        },
      });
    }
  }
  list.sort((a, b) => a.at - b.at);
  const batch = list.slice(0, MAX_NOTIFICATIONS).map((x) => x.n);

  // 1) plan the new reminders first. An id that already exists is simply replaced, so there is never a moment
  //    with no reminders, and if this fails the reminders planned earlier stay in place.
  if (batch.length) {
    try {
      await LocalNotifications.schedule({ notifications: batch });
      lastError = "";
    } catch (e) {
      lastError = String(e?.message || e);
      return 0;
    }
  }
  // 2) only then remove what is no longer wanted (deleted habits, a changed time, today's reminder once done,
  //    and anything left over from the old alarm version)
  const keep = new Set(batch.map((n) => n.id));
  await cancelIds((await pending()).filter((n) => n.id !== TEST_ID && !keep.has(n.id)).map((n) => n.id));
  return batch.length;
}

/** Shows a test notification in a few seconds. */
export async function sendTestNotification() {
  if (!isNative()) return false;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: TEST_ID,
        title: "Test notification",
        body: "If you can see this, your habit reminders will reach you.",
        schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
        channelId: CHANNEL,
        autoCancel: true,
      }],
    });
    return true;
  } catch {
    return false;
  }
}

/** Runs the callback when you tap a notification. Returns a promise of a handle with remove(). */
export function onNotificationTap(callback) {
  return LocalNotifications.addListener("localNotificationActionPerformed", () => callback());
}
