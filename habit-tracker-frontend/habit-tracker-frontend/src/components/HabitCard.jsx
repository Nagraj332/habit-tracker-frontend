import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, api, fmt, isActiveOn } from "../api";
import { confettiFrom } from "../fx";
import { fmt12 } from "../time";
import Icon from "./Icon";

export default function HabitCard({ habit, version, onToggle }) {
  const [done, setDone] = useState(new Set());
  const [burst, setBurst] = useState(false);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  useEffect(() => {
    let alive = true;
    api.logs(habit.id, fmt(days[0]), fmt(today)).then((d) => alive && setDone(new Set(d))).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit.id, version]);

  const checkToday = (e) => {
    if (!habit.completedToday) {
      confettiFrom(e.currentTarget);
      setBurst(true);
      setTimeout(() => setBurst(false), 700);
    }
    onToggle(habit.id, fmt(today));
  };

  return (
    <article className={`card ${habit.completedToday ? "done" : ""}`} style={{ "--c": habit.color || "#4CAF50" }}>
      <div className="row">
        <button
          className={`check ${habit.completedToday ? "on" : ""} ${burst ? "burst" : ""}`}
          onClick={checkToday}
          aria-pressed={habit.completedToday}
          aria-label={habit.completedToday ? `Undo ${habit.name} for today` : `Mark ${habit.name} done for today`}
        >
          <Icon name="check" size={24} />
        </button>

        <Link className="info" to={`/habits/${habit.id}`}>
          <h2>{habit.name}</h2>
          {habit.description && <p>{habit.description}</p>}
        </Link>

        <div className={`streak ${habit.currentStreak > 0 ? "hot" : ""}`} title="Current streak">
          <Icon name="flame" size={22} />
          <strong>{habit.currentStreak}</strong>
        </div>
      </div>

      <div className="week">
        {days.map((d) => {
          const key = fmt(d);
          return (
            <button
              key={key}
              className={`day ${done.has(key) ? "on" : ""} ${key === fmt(today) ? "today" : ""}`}
              disabled={!isActiveOn(habit, key)}
              onClick={() => onToggle(habit.id, key)}
              title={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
              aria-label={`${key}: ${done.has(key) ? "done" : "not done"}`}
            >
              {d.toLocaleDateString(undefined, { weekday: "narrow" })}
            </button>
          );
        })}
      </div>
    </article>
  );
}
