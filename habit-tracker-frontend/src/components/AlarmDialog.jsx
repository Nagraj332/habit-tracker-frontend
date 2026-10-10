import { useEffect } from "react";
import Icon from "./Icon";

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
            <h2>Time for {h.name}</h2>
            <p className="muted">
              {h.description || "You haven't done this one yet today."}
              {h.currentStreak > 0 && ` Keep your ${h.currentStreak} day streak going.`}
            </p>
          </>
        )}
        {item.type === "nudge" && (
          <>
            <h2>{item.habits.length} {item.habits.length === 1 ? "habit is" : "habits are"} still to do today</h2>
            <ul className="nudgelist">{item.habits.map((x) => <li key={x.id}>{x.name}</li>)}</ul>
          </>
        )}
        {item.type === "test" && (
          <>
            <h2>Test alarm</h2>
            <p className="muted">If you can hear this, your alarm tune works.</p>
          </>
        )}

        {blocked && <p className="err">Your browser blocked the sound. Click anywhere on the page once, then use Test alarm in Reminders.</p>}

        <div className="alarmactions">
          {item.type === "habit" && <button className="btn primary" onClick={onDone}><Icon name="check" size={18} /> Mark done</button>}
          {item.type === "habit" && <button className="btn" onClick={onSnooze}>Snooze {snooze} min</button>}
          {item.type === "nudge" && <button className="btn primary" onClick={onOpenToday}>Open Today</button>}
          <button className="btn" onClick={onDismiss}>{item.type === "test" ? "Stop" : "Dismiss"}</button>
        </div>
      </div>
    </div>
  );
}
