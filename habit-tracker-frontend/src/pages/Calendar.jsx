import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { addDays, api, fmt, isActiveOn } from "../api";
import Icon from "../components/Icon";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export default function Calendar() {
  const { shown: habits, version, toggle, openNew } = useOutletContext();
  const todayKey = fmt(new Date());
  const [cursor, setCursor] = useState(() => monthStart(new Date()));
  const [sel, setSel] = useState(todayKey);
  const [logs, setLogs] = useState({});
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState(new Set());

  const days = useMemo(() => {
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const out = [];
    for (let d = addDays(cursor, -cursor.getDay()); d <= addDays(last, 6 - last.getDay()); d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor]);
  const from = fmt(days[0]);
  const to = fmt(days[days.length - 1]);

  useEffect(() => {
    let alive = true;
    Promise.all(habits.map((h) => api.logs(h.id, from, to).then((d) => [h.id, new Set(d)]).catch(() => [h.id, new Set()]))).then(
      (rs) => alive && setLogs(Object.fromEntries(rs))
    );
    return () => { alive = false; };
  }, [habits, version, from, to]);

  const go = (n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const isDone = (h, key) => Boolean(logs[h.id]?.has(key));

  const selDate = new Date(sel + "T00:00:00");
  const selHabits = habits.filter((h) => isActiveOn(h, sel));
  const selFuture = sel > todayKey;
  const selLabel = selDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <header className="top"><div><h1>Calendar</h1><p className="sub">See your month and plan habits for future days.</p></div></header>

      <section className="panel">
        <div className="calhead">
          <button className="iconbtn" onClick={() => go(-1)} aria-label="Previous month"><Icon name="back" size={18} /></button>
          <h2>{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
          <button className="btn small" onClick={() => { setCursor(monthStart(new Date())); setSel(todayKey); }}>Today</button>
          <button className={`btn small ${multi ? "primary" : ""}`} onClick={() => { setMulti((m) => !m); setPicked(new Set()); }}>{multi ? "Done selecting" : "Select dates"}</button>
          <button className="iconbtn" onClick={() => go(1)} aria-label="Next month"><Icon name="next" size={18} /></button>
        </div>

        <div className="calgrid" key={cursor.getTime()}>
          {WEEKDAYS.map((w) => <div className="calwd" key={w}>{w}</div>)}
          {days.map((d) => {
            const key = fmt(d);
            const list = habits.filter((h) => isActiveOn(h, key));
            const future = key > todayKey;
            const past = key < todayKey;
            const done = list.filter((h) => isDone(h, key)).length;
            return (
              <button
                key={key}
                className={`cal-day ${d.getMonth() === cursor.getMonth() ? "" : "out"} ${key === todayKey ? "today" : ""} ${multi ? (picked.has(key) ? "picked" : "") : key === sel ? "sel" : ""} ${future ? "future" : ""}`}
                disabled={multi && past}
                onClick={() => (multi ? (past ? null : setPicked((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; })) : setSel(key))}
                aria-label={`${d.toDateString()}, ${list.length} habits`}
                aria-pressed={multi ? picked.has(key) : key === sel}
              >
                <span className="num">{d.getDate()}</span>
                <span className="dots">
                  {list.slice(0, 4).map((h) => <i key={h.id} className={`dotc ${!future && isDone(h, key) ? "on" : ""}`} style={{ "--c": h.color }} />)}
                  {list.length > 4 && <em>+{list.length - 4}</em>}
                </span>
                {!future && list.length > 0 && <small>{done}/{list.length}</small>}
              </button>
            );
          })}
        </div>
      </section>

      {multi && (
        <section className="panel">
          <div className="setrow">
            <div>
              <h2>{picked.size} {picked.size === 1 ? "date" : "dates"} selected</h2>
              <p className="hint">Tap days on the calendar, then create one habit for all of them.</p>
            </div>
            <div className="hactions">
              <button className="btn" onClick={() => setPicked(new Set())}>Clear</button>
              <button className="btn primary" disabled={picked.size === 0} onClick={() => openNew([...picked].filter((k) => k >= todayKey).sort())}><Icon name="plus" size={16} /> Add habit</button>
            </div>
          </div>
        </section>
      )}

      <section className="panel" key={sel} hidden={multi}>
        <div className="setrow">
          <div><h2>{selLabel}</h2><p className="hint">{selFuture ? "Planned habits for this day." : sel < todayKey ? "Tap a circle to mark a habit done or not done. New habits start today or later." : "Tap a circle to mark a habit done or not done."}</p></div>
          <button className="btn primary" onClick={() => openNew(sel < todayKey ? todayKey : sel)}><Icon name="plus" size={16} /> Add habit</button>
        </div>
        {selHabits.length === 0 ? (
          <p className="hint">No habits on this day yet. Use Add habit to start one here.</p>
        ) : (
          <div className="dayrows">
            {selHabits.map((h) => (
              <div className="dayrow" key={h.id} style={{ "--c": h.color }}>
                {!selFuture && (
                  <button className={`minicheck ${isDone(h, sel) ? "on" : ""}`} onClick={() => toggle(h.id, sel)} aria-pressed={isDone(h, sel)} aria-label={`${h.name} on ${selLabel}`}>
                    <Icon name="check" size={18} />
                  </button>
                )}
                <b>{h.name}</b>
                {selFuture && <span className="tag">{!h.scheduledDates?.length && h.createdDate === sel ? "Starts" : "Planned"}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
