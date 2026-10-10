import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, errMsg, fmt, isActiveOn } from "./api";
import { notify, startAlarm, stopAlarm, vibrate } from "./alarm";
import { celebrate } from "./fx";
import { fmtKm } from "./format";
import { useWalk } from "./useWalk";
import AlarmDialog from "./components/AlarmDialog";
import Background from "./components/Background";
import Footer from "./components/Footer";
import HabitModal from "./components/HabitModal";
import Navbar from "./components/Navbar";
import { loadSettings, saveSettings } from "./settings";
import Calendar from "./pages/Calendar";
import Habits from "./pages/Habits";
import HabitDetail from "./pages/HabitDetail";
import Insights from "./pages/Insights";
import NotFound from "./pages/NotFound";
import Reminders from "./pages/Reminders";
import Today from "./pages/Today";
import Walk from "./pages/Walk";

const TITLES = { "/": "Today", "/calendar": "Calendar", "/habits": "Habits", "/walk": "Walk / Run", "/insights": "Insights", "/reminders": "Reminders" };

// keys of alarms already fired today, so a page refresh doesn't ring the same alarm twice
const loadFired = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem("habit-fired") || "[]").filter((k) => k.startsWith(fmt(new Date()))));
  } catch {
    return new Set();
  }
};
const markFired = (set, key) => {
  set.add(key);
  try { localStorage.setItem("habit-fired", JSON.stringify([...set])); } catch { /* ignore */ }
};

function Layout() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0); // bumps after each check-in so views refetch their data
  const [editing, setEditing] = useState(null); // null = closed, {} = new, habit = edit
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch {
      return "light";
    }
  });
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [settings, setSettingsState] = useState(loadSettings);
  const [ringing, setRinging] = useState(null); // { type: "habit" | "nudge" | "test", ... }
  const [blocked, setBlocked] = useState(false);
  const snoozes = useRef({});
  const fired = useRef(loadFired());
  const latest = useRef({});
  const walk = useWalk();
  const [walkVersion, setWalkVersion] = useState(0);
  const goalHit = useRef(false);

  // search: typing filters every page live; picking a suggestion narrows the app to that one habit
  const [search, setSearch] = useState({ text: "", id: null });
  const setSearchText = (text) => setSearch({ text, id: null });
  const clearSearch = () => setSearch({ text: "", id: null });
  const query = search.text.trim().toLowerCase();
  const shown = !query
    ? habits
    : search.id
      ? habits.filter((h) => h.id === search.id)
      : habits.filter((h) => `${h.name} ${h.description || ""}`.toLowerCase().includes(query));
  const pickHabit = (h) => {
    setSearch({ text: h.name, id: h.id });
    if (!["/", "/habits", "/calendar", "/insights"].includes(pathname)) nav("/");
  };
  useEffect(() => {
    if (search.id && !habits.some((h) => h.id === search.id)) setSearch({ text: "", id: null });
  }, [habits]); // eslint-disable-line react-hooks/exhaustive-deps
  const [installEvt, setInstallEvt] = useState(null);

  // "Install app" prompt (Chrome / Edge / Android)
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvt(e); };
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  };

  const setSettings = (fn) =>
    setSettingsState((prev) => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      saveSettings(next);
      return next;
    });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (TITLES[pathname]) document.title = `${TITLES[pathname]} | Habit Tracker`;
  }, [pathname]);

  const say = (msg) => setToast({ msg, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    try {
      setHabits(await api.list());
      setError("");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (id, date) => {
    try {
      const u = await api.toggle(id, date);
      setHabits((hs) => hs.map((h) => (h.id === id ? u : h)));
      setVersion((v) => v + 1);
      setError("");
      if (date !== fmt(new Date())) say("Day updated");
      else if (!u.completedToday) say(`${u.name} unmarked`);
      else say(u.currentStreak > 1 ? `${u.name} done, ${u.currentStreak} day streak` : `${u.name} done for today`);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const save = async (data) => {
    const isEdit = Boolean(editing?.id);
    if (isEdit) await api.update(editing.id, data);
    else await api.create(data);
    setEditing(null);
    await load();
    say(isEdit ? "Habit updated" : "Habit added");
  };

  const remove = async (habit) => {
    if (!window.confirm(`Delete "${habit.name}" and all its history?`)) return false;
    try {
      await api.remove(habit.id);
      setHabits((hs) => hs.filter((h) => h.id !== habit.id));
      say("Habit deleted");
      return true;
    } catch (e) {
      setError(errMsg(e));
      return false;
    }
  };

  // ----- alarms and reminders -----
  const fire = async (item) => {
    setRinging(item);
    setBlocked(false);
    if (item.type === "habit") notify(`Time for ${item.habit.name}`, item.habit.description || "You haven't done this one yet today.", `habit-${item.habit.id}`, latest.current.settings.vibrateOn);
    if (item.type === "nudge") notify(`${item.habits.length} habit${item.habits.length === 1 ? "" : "s"} still to do today`, item.habits.map((h) => h.name).join(", "), "nudge", latest.current.settings.vibrateOn);
    const maxMs = item.type === "habit" ? 60000 : item.type === "test" ? 15000 : 5000;
    const s = latest.current.settings;
    if (s.alarmOn || item.type === "test") {
      const r = await startAlarm({ volume: s.volume, maxMs, vibrate: s.vibrateOn });
      if (r.blocked) setBlocked(true);
    } else if (s.vibrateOn) {
      vibrate([300, 150, 300, 150, 600]); // silent reminder: vibration only, no sound
    }
  };
  latest.current = { habits, settings, ringing, fire };

  useEffect(() => {
    const tick = () => {
      const { habits, settings, ringing, fire } = latest.current;
      if (ringing) return;
      const now = new Date();
      const day = fmt(now);
      const mins = now.getHours() * 60 + now.getMinutes();
      const toMins = (t) => { const [a, b] = t.split(":").map(Number); return a * 60 + b; };
      const due = (t) => { const d = mins - toMins(t); return d >= 0 && d <= 2; };

      for (const [id, at] of Object.entries(snoozes.current)) {
        if (Date.now() < at) continue;
        delete snoozes.current[id];
        const h = habits.find((x) => String(x.id) === id);
        if (h && !h.completedToday) return fire({ type: "habit", habit: h });
      }
      for (const h of habits) {
        if (!h.reminderTime || h.completedToday || !isActiveOn(h, day)) continue;
        const key = `${day}|${h.id}|${h.reminderTime}`;
        if (due(h.reminderTime) && !fired.current.has(key)) {
          markFired(fired.current, key);
          return fire({ type: "habit", habit: h });
        }
      }
      if (settings.nudgeOn && settings.nudgeTime) {
        const key = `${day}|nudge|${settings.nudgeTime}`;
        const pending = habits.filter((h) => !h.completedToday && isActiveOn(h, day));
        if (due(settings.nudgeTime) && !fired.current.has(key) && pending.length) {
          markFired(fired.current, key);
          fire({ type: "nudge", habits: pending });
        }
      }
    };
    tick();
    const iv = setInterval(tick, 10000);
    return () => clearInterval(iv);
  }, []);

  // ----- walking -----
  useEffect(() => {
    if (walk.status === "idle") { goalHit.current = false; return; }
    const goal = settings.walkGoal * 1000;
    if (walk.status === "tracking" && goal > 0 && walk.distance >= goal && !goalHit.current) {
      goalHit.current = true;
      say(`Goal reached: ${settings.walkGoal} km`);
      celebrate();
      if (settings.vibrateOn) vibrate([200, 100, 200, 100, 500]);
    }
  }, [walk.distance, walk.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishWalk = async () => {
    const w = walk.finish();
    if (w.distanceMeters < 20) return say("That was too short to save");
    const habit = habits.find((h) => String(h.id) === String(settings.walkHabit));
    try {
      await api.createWalk({ habitId: habit ? habit.id : null, walkDate: fmt(new Date()), distanceMeters: Math.round(w.distanceMeters), durationSeconds: w.durationSeconds, activityType: settings.walkActivity });
      setWalkVersion((v) => v + 1);
      say(`${settings.walkActivity === "RUN" ? "Run" : "Walk"} saved: ${fmtKm(w.distanceMeters)} km`);
      const reached = settings.walkGoal <= 0 || w.distanceMeters >= settings.walkGoal * 1000;
      if (habit && reached && !habit.completedToday && isActiveOn(habit, fmt(new Date()))) await toggle(habit.id, fmt(new Date()));
    } catch (e) {
      setError(errMsg(e));
    }
  };

  // click ripple on buttons
  useEffect(() => {
    const onDown = (e) => {
      const el = e.target.closest?.(".btn, .chip, .iconbtn, .day");
      if (!el || el.disabled) return;
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2;
      const s = document.createElement("span");
      s.className = "ripple";
      s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      el.appendChild(s);
      setTimeout(() => s.remove(), 650);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const closeAlarm = () => { stopAlarm(); setRinging(null); };
  const alarmDone = async () => { const h = ringing.habit; closeAlarm(); await toggle(h.id, fmt(new Date())); };
  const alarmSnooze = () => {
    snoozes.current[ringing.habit.id] = Date.now() + settings.snooze * 60000;
    say(`Snoozed for ${settings.snooze} minutes`);
    closeAlarm();
  };

  const ctx = {
    habits, loading, version, toggle, remove, say, setError, settings, setSettings, reload: load,
    walk, walkVersion, finishWalk,
    shown, search, setSearchText, clearSearch,
    testAlarm: () => fire({ type: "test" }),
    openNew: (arg) => setEditing(typeof arg === "string" ? { startDate: arg } : Array.isArray(arg) ? { scheduledDates: arg } : {}),
    openEdit: (h) => setEditing(h),
  };

  return (
    <>
      <Background />
      <div className="shell">
        <Navbar habits={habits} search={search} onText={setSearchText} onPick={pickHabit} onSearchAll={() => nav("/habits")} onClear={clearSearch} onInstall={installEvt ? install : null} theme={theme} onTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} onNew={() => setEditing({})} />
        <main className="main">
          {error && (
            <div className="alert" role="alert">
              {error}
              <button className="link" onClick={load}>Try again</button>
            </div>
          )}
          <Outlet context={ctx} />
        </main>
        <Footer />
      </div>
      {editing && <HabitModal habit={editing} onSave={save} onClose={() => setEditing(null)} />}
      {walk.status !== "idle" && pathname !== "/walk" && (
        <Link to="/walk" className="walkpill"><i /> {settings.walkActivity === "RUN" ? "Run" : "Walk"} {fmtKm(walk.distance)} km{walk.status === "paused" ? " (paused)" : ""}</Link>
      )}
      <AlarmDialog item={ringing} blocked={blocked} snooze={settings.snooze} onDone={alarmDone} onSnooze={alarmSnooze} onDismiss={closeAlarm} onOpenToday={() => { closeAlarm(); nav("/"); }} />
      {toast && <div className="toast" key={toast.id} role="status">{toast.msg}</div>}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="habits" element={<Habits />} />
        <Route path="habits/:id" element={<HabitDetail />} />
        <Route path="walk" element={<Walk />} />
        <Route path="insights" element={<Insights />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
