const KEY = "habit-settings";

export const DEFAULTS = { alarmOn: true, volume: 0.8, snooze: 10, nudgeOn: true, nudgeTime: "20:00", vibrateOn: true, walkGoal: 2, walkHabit: "", walkActivity: "WALK" };

export const loadSettings = () => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
};

export const saveSettings = (s) => {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
};
