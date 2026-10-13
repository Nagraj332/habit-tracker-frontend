import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api, fmt } from "../api";
import CountUp from "../components/CountUp";
import Icon from "../components/Icon";

export default function Insights() {
  const { shown: habits, loading, version } = useOutletContext();
  const [stats, setStats] = useState({});

  useEffect(() => {
    let alive = true;
    Promise.all(habits.map((h) => api.stats(h.id).then((s) => [h.id, s]).catch(() => [h.id, null]))).then(
      (rs) => alive && setStats(Object.fromEntries(rs))
    );
    return () => { alive = false; };
  }, [habits, version]);

  if (!loading && habits.length === 0) {
    return (
      <>
        <header className="top"><h1>Insights</h1></header>
        <div className="empty"><p>Add a habit and check it off for a few days to see your progress here.</p><Link className="btn primary" to="/habits">Go to habits</Link></div>
      </>
    );
  }

  const rows = habits.filter((h) => h.createdDate <= fmt(new Date())).map((h) => ({ h, s: stats[h.id] })).sort((a, b) => (b.s?.completionRateLast30Days ?? 0) - (a.s?.completionRateLast30Days ?? 0));
  const known = rows.filter((r) => r.s);
  const best = known.reduce((m, r) => (!m || r.s.currentStreak > m.s.currentStreak ? r : m), null);
  const avg = known.length ? Math.round(known.reduce((a, r) => a + r.s.completionRateLast30Days, 0) / known.length) : 0;
  const total = known.reduce((a, r) => a + r.s.totalCompletions, 0);
  const doneToday = habits.filter((h) => h.completedToday).length;

  const tiles = [
    ["Done today", `${doneToday} of ${habits.length}`],
    ["Average, last 30 days", avg, "%"],
    ["Best current streak", best ? best.s.currentStreak : 0, " days"],
    ["Total check-ins", total],
  ];

  return (
    <>
      <header className="top"><div><h1>Insights</h1><p className="sub">How consistent you have been across all habits.</p></div></header>

      <div className="tiles">
        {tiles.map(([label, value, suffix]) => <div className="tile" key={label}><strong><CountUp value={value} suffix={suffix} /></strong><span>{label}</span></div>)}
      </div>

      <section className="panel">
        <h2>Consistency, last 30 days</h2>
        <div className="bars">
          {rows.map(({ h, s }) => (
            <Link key={h.id} to={`/habits/${h.id}`} className="brow" style={{ "--c": h.color }}>
              <div className="brow-top">
                <b>{h.name}</b>
                <span>{s ? `${s.completionRateLast30Days}%` : "…"}</span>
              </div>
              <div className="track"><div className="fillbar" style={{ width: `${s?.completionRateLast30Days ?? 0}%` }} /></div>
              <small>
                <Icon name="flame" size={14} /> {s ? s.currentStreak : 0} day streak, best {s ? s.longestStreak : 0}, {s ? s.totalCompletions : 0} check-ins
              </small>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
