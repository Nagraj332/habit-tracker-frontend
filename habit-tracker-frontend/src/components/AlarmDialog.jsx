import { useEffect } from "react";
import Icon from "./Icon";

const time12 = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function AlarmDialog({ item, blocked, snooze, onDone, onSnooze, onDismiss, onOpenToday }) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onDismiss]);

  if (!item) return null;
  const h = item.habit;

  return (
    <div className="overlay alarm" role="alertdialog" aria-modal="true" aria-label="Habit reminder">
      <div className="modal alarmbox" style={{ "--c": h?.color || "#0f9d8a" }}>
        <div className="bell"><Icon name="bell" size={34} /></div>

        {item.type === "habit" && (
          <>
            <p className="alarmkicker">{h.reminderTime ? `${time12(h.reminderTime)} · ` : ""}Habit reminder</p>
            <h2>{h.name}</h2>
            <p className="muted alarmtext">{h.description || "You haven't done this one yet today."}</p>
            {h.currentStreak > 0 && <span className="streakchip"><Icon name="flame" size={14} /> {h.currentStreak} day streak</span>}
          </>
        )}
        {item.type === "nudge" && (
          <>
            <p className="alarmkicker">Daily check</p>
            <h2>{item.habits.length} {item.habits.length === 1 ? "habit is" : "habits are"} still to do today</h2>
            <ul className="nudgelist">{item.habits.map((x) => <li key={x.id}>{x.name}</li>)}</ul>
          </>
        )}
        {item.type === "test" && (
          <>
            <p className="alarmkicker">Test</p>
            <h2>Test alarm</h2>
            <p className="muted alarmtext">If you can hear this, your alarm tune works.</p>
          </>
        )}

        {blocked && <p className="err">Your browser blocked the sound. Tap anywhere on the page once, then use Test alarm in Reminders.</p>}

        <div className="alarmactions">
          {item.type === "habit" && <button className="btn primary big" onClick={onDone}><Icon name="check" size={20} /> Mark done</button>}
          {item.type === "nudge" && <button className="btn primary big" onClick={onOpenToday}>Open Today</button>}
          <div className="alarmrow">
            {item.type === "habit" && <button className="btn" onClick={onSnooze}>Snooze {snooze} min</button>}
            <button className="btn" onClick={onDismiss}>{item.type === "test" ? "Stop" : "Dismiss"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
