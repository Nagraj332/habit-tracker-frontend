import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { addDays, api, fmt, isActiveOn } from "../api";
import Breadcrumbs from "../components/Breadcrumbs";
import CountUp from "../components/CountUp";
import Icon from "../components/Icon";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function HabitDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { habits, loading, version, toggle, openEdit, remove } = useOutletContext();
  const habit = habits.find((h) => String(h.id) === id);
  const [stats, setStats] = useState(null);
  const [dates, setDates] = useState(new Set());

  const { weeks, from } = useMemo(() => {
    const end = new Date();
    let start = addDays(end, -364);
    start = addDays(start, -start.getDay()); // start on a Sunday so each column is one week
    const all = [];
    for (let d = start; d <= end; d = addDays(d, 1)) all.push(fmt(d));
    const w = [];
    for (let i = 0; i < all.length; i += 7) w.push(all.slice(i, i + 7));
    return { weeks: w, from: all[0] };
  }, []);

  const exists = Boolean(habit);
  useEffect(() => {
    if (!exists) return;
    api.stats(id).then(setStats).catch(() => {});
    api.logs(id, from, fmt(new Date())).then((d) => setDates(new Set(d))).catch(() => {});
  }, [id, from, version, exists]);

  useEffect(() => {
    if (habit) document.title = `${habit.name} | Habit Tracker`;
  }, [habit?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!habit) {
    return loading ? <div className="skel" /> : (
      <div className="empty">
        <p>This habit doesn't exist any more.</p>
        <Link className="btn primary" to="/habits">Back to habits</Link>
      </div>
    );
  }

  const tiles = stats
    ? [["Current streak", stats.currentStreak, " days"], ["Longest streak", stats.longestStreak, " days"], ["Total check-ins", stats.totalCompletions, ""], ["Last 30 days", stats.completionRateLast30Days, "%"]]
    : [];

  return (
    <div style={{ "--c": habit.color }}>
      <Breadcrumbs items={[{ to: "/", label: "Home" }, { to: "/habits", label: "Habits" }, { label: habit.name }]} />

      <header className="top">
        <div>
          <h1 className="dtitle"><span className="dot" />{habit.name}</h1>
          {habit.description && <p className="sub">{habit.description}</p>}
        </div>
        <button className={`btn ${habit.completedToday ? "" : "primary"}`} onClick={() => toggle(habit.id, fmt(new Date()))}>
          {habit.completedToday ? "Undo today" : "Mark today done"}
        </button>
      </header>

      <div className="tiles">
        {tiles.length === 0 ? [0, 1, 2, 3].map((i) => <div key={i} className="tile skeltile" />) : tiles.map(([label, value, suffix]) => (
          <div className="tile" key={label}><strong><CountUp value={value} suffix={suffix} /></strong><span>{label}</span></div>
        ))}
      </div>

      <section className="panel">
        <h2>Past year</h2>
        <p className="hint">Click any day to mark or unmark it.</p>
        <div className="heat-wrap">
          <div className="hm">
            {weeks.map((w, i) => {
              const m = Number(w[0].slice(5, 7));
              const show = i === 0 || m !== Number(weeks[i - 1][0].slice(5, 7));
              return (
                <div className="wk" key={w[0]}>
                  <span className="m">{show ? MONTHS[m - 1] : ""}</span>
                  {w.map((d) => (
                    <button
                      key={d}
                      className={`cell ${dates.has(d) ? "on" : ""}`}
                      disabled={!isActiveOn(habit, d)}
                      onClick={() => toggle(habit.id, d)}
                      title={`${d}${dates.has(d) ? " (done)" : ""}`}
                      aria-label={`${d}: ${dates.has(d) ? "done" : "not done"}`}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="hactions">
        <button className="btn" onClick={() => openEdit(habit)}><Icon name="edit" size={16} /> Edit habit</button>
        <button className="btn danger" onClick={async () => (await remove(habit)) && nav("/habits")}><Icon name="trash" size={16} /> Delete</button>
      </div>
    </div>
  );
}
