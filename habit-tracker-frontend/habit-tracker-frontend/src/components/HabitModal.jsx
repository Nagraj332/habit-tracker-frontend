import { useCallback, useEffect, useState } from "react";
import { errMsg, fmt } from "../api";
import MultiDatePicker from "./MultiDatePicker";
import TimePicker from "./TimePicker";

const COLORS = ["#4CAF50", "#2196F3", "#9C27B0", "#FF9800", "#E91E63", "#00BCD4", "#795548", "#607D8B"];

export default function HabitModal({ habit, onSave, onClose }) {
  const [name, setName] = useState(habit.name || "");
  const [description, setDescription] = useState(habit.description || "");
  const [color, setColor] = useState(habit.color || COLORS[0]);
  const [reminder, setReminder] = useState(habit.reminderTime || "");
  const [start, setStart] = useState(habit.startDate || habit.createdDate || fmt(new Date()));
  const [mode, setMode] = useState(habit.scheduledDates?.length ? "dates" : "daily");
  const [dates, setDates] = useState(habit.scheduledDates || []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const chooseDates = () => {
    setMode("dates");
    if (dates.length === 0 && start) setDates([start]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Give your habit a name.");
    if (mode === "dates" && dates.length === 0) return setError("Pick at least one date on the calendar.");
    if (!reminder) return setError("Set a reminder time for this habit.");
    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        color,
        reminderTime: reminder,
        startDate: mode === "daily" ? start || null : null,
        scheduledDates: mode === "dates" ? dates : [],
      });
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <div className={`overlay ${leaving ? "leaving" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <form className="modal" onSubmit={submit} aria-label={habit.id ? "Edit habit" : "New habit"}>
        <h2>{habit.id ? "Edit habit" : "New habit"}</h2>

        <label>
          Name
          <input autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Morning run" />
        </label>

        <label>
          Description (optional)
          <input value={description} maxLength={255} onChange={(e) => setDescription(e.target.value)} placeholder="30 minutes before work" />
        </label>

        <div className="field">
          <span className="lbl">When</span>
          <div className="ampm seg" role="group" aria-label="Schedule type">
            <button type="button" className={mode === "daily" ? "on" : ""} onClick={() => setMode("daily")} aria-pressed={mode === "daily"}>Every day</button>
            <button type="button" className={mode === "dates" ? "on" : ""} onClick={chooseDates} aria-pressed={mode === "dates"}>Specific dates</button>
          </div>
          {mode === "daily" ? (
            <label className="inner">
              Starts on
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              <small className="muted">Pick a future date to plan a habit ahead.</small>
            </label>
          ) : (
            <MultiDatePicker value={dates} onChange={setDates} />
          )}
        </div>

        <div className="field">
          <span className="lbl">Daily reminder (required)</span>
          <TimePicker value={reminder} onChange={(v) => { setReminder(v); setError(""); }} label="Reminder time" />
        </div>

        <fieldset>
          <legend>Color</legend>
          <div className="swatches">
            {COLORS.map((c) => (
              <button type="button" key={c} className={`swatch ${c === color ? "sel" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={c === color} />
            ))}
          </div>
        </fieldset>

        {error && <p className="err">{error}</p>}

        <div className="actions">
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{habit.id ? "Save changes" : "Add habit"}</button>
        </div>
      </form>
    </div>
  );
}
