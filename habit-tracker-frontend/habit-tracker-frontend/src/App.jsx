import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, errMsg, fmt, isActiveOn } from "./api";
import { readHabitCache, writeHabitCache } from "./cache";
import { getInstallEvent, runInstall, subscribeInstall } from "./install";
import { celebrate } from "./fx";
import { fmtKm } from "./format";
import { useWalk } from "./useWalk";
import Background from "./components/Background";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import HabitModal from "./components/HabitModal";
import InstallSheet from "./components/InstallSheet";
import UpdateBanner from "./components/UpdateBanner";
import Navbar from "./components/Navbar";
import { loadSettings, saveSettings } from "./settings";
import Calendar from "./pages/Calendar";
import Habits from "./pages/Habits";
import HabitDetail from "./pages/HabitDetail";
import Insights from "./pages/Insights";
import NotFound from "./pages/NotFound";
import Today from "./pages/Today";
import Walk from "./pages/Walk";

const TITLES = { "/": "Today", "/calendar": "Calendar", "/habits": "Habits", "/walk": "Walk / Run", "/insights": "Insights" };

function Layout() {
  // show the habits saved on this device straight away; the server answers in the background
  const boot = useRef(null);
  if (boot.current === null) boot.current = readHabitCache() || false;
  const synced = useRef(false);
  const [habits, setHabits] = useState(boot.current || []);
  const [loading, setLoading] = useState(!boot.current);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0); // bumps after each check-in so views refetch their data
  const [editing, setEditing] = useState(null); // null = closed, {} = new, habit = edit
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme-pref") || "light"; // light unless the user picked dark
    } catch {
      return "light";
    }
  });
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [settings, setSettingsState] = useState(loadSettings);
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
  // "Install app" button (Chrome / Edge / Android); the first-visit sheet uses the same event
  const installEvt = useSyncExternalStore(subscribeInstall, getInstallEvent);
  const install = () => runInstall();

  const setSettings = (fn) =>
    setSettingsState((prev) => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      saveSettings(next);
      return next;
    });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("theme-pref", theme); } catch { /* ignore */ }
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
      synced.current = true;
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

  // keep the on-device copy current (only after the server has answered once)
  useEffect(() => {
    if (synced.current) writeHabitCache(habits);
  }, [habits]);

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

  // ----- walking -----
  useEffect(() => {
    if (walk.status === "idle") { goalHit.current = false; return; }
    const goal = settings.walkGoal * 1000;
    if (walk.status === "tracking" && goal > 0 && walk.distance >= goal && !goalHit.current) {
      goalHit.current = true;
      say(`Goal reached: ${settings.walkGoal} km`);
      celebrate();
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

  const ctx = {
    habits, loading, version, toggle, remove, say, setError, settings, setSettings, reload: load,
    walk, walkVersion, finishWalk,
    shown, search, setSearchText, clearSearch,
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
      <InstallSheet />
      <UpdateBanner />
      {editing && <HabitModal habit={editing} onSave={save} onClose={() => setEditing(null)} />}
      {walk.status !== "idle" && pathname !== "/walk" && (
        <Link to="/walk" className="walkpill"><i /> {settings.walkActivity === "RUN" ? "Run" : "Walk"} {fmtKm(walk.distance)} km{walk.status === "paused" ? " (paused)" : ""}</Link>
      )}
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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
