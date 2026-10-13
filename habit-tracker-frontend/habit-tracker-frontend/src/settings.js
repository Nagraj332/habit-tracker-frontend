const KEY = "habit-settings";

export const DEFAULTS = { nudgeOn: true, nudgeTime: "20:00", walkGoal: 2, walkHabit: "", walkActivity: "WALK" };

export const loadSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "{}");
    // keep only the settings that still exist (the old alarm sound, volume, snooze and vibration are dropped)
    return Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, stored[k] ?? DEFAULTS[k]]));
  } catch {
    return DEFAULTS;
  }
};

export const saveSettings = (s) => {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
};
