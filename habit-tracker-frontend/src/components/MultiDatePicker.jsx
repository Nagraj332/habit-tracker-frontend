import { useMemo, useState } from "react";
import { addDays, fmt, shortDate } from "../api";
import Icon from "./Icon";

const WD = ["S", "M", "T", "W", "T", "F", "S"];
const first = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

/** Month calendar where each tap adds or removes a date. value / onChange use sorted "yyyy-MM-dd" arrays. */
export default function MultiDatePicker({ value, onChange }) {
  const sel = new Set(value);
  const [cursor, setCursor] = useState(() => first(value.length ? new Date(value[0] + "T00:00:00") : new Date()));
  const todayKey = fmt(new Date());

  const days = useMemo(() => {
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const out = [];
    for (let d = addDays(cursor, -cursor.getDay()); d <= addDays(last, 6 - last.getDay()); d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor]);

  const commit = (set) => onChange([...set].sort());
  const toggle = (key) => {
    const n = new Set(sel);
    n.has(key) ? n.delete(key) : n.add(key);
    commit(n);
  };
  const addNext = (count) => {
    const n = new Set(sel);
    for (let i = 0; i < count; i++) n.add(fmt(addDays(new Date(), i)));
    commit(n);
  };
  const go = (n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <div className="mdp">
      <div className="mdp-head">
        <button type="button" className="iconbtn" onClick={() => go(-1)} aria-label="Previous month"><Icon name="back" size={16} /></button>
        <span>{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button type="button" className="iconbtn" onClick={() => go(1)} aria-label="Next month"><Icon name="next" size={16} /></button>
      </div>

      <div className="mdp-grid">
        {WD.map((w, i) => <span className="mdp-wd" key={i}>{w}</span>)}
        {days.map((d) => {
          const key = fmt(d);
          return (
            <button
              type="button"
              key={key}
              className={`mdp-day ${sel.has(key) ? "sel" : ""} ${key === todayKey ? "today" : ""} ${d.getMonth() === cursor.getMonth() ? "" : "out"}`}
              onClick={() => toggle(key)}
              disabled={key < todayKey && !sel.has(key)}
              aria-pressed={sel.has(key)}
              aria-label={d.toDateString()}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mdp-tools">
        <button type="button" className="btn small" onClick={() => addNext(7)}>Next 7 days</button>
        <button type="button" className="btn small" onClick={() => addNext(30)}>Next 30 days</button>
        {value.length > 0 && <button type="button" className="btn small danger" onClick={() => onChange([])}>Clear all</button>}
      </div>

      <p className="hint" style={{ margin: "10px 0 0" }}>{value.length === 0 ? "Tap days to choose them." : `${value.length} ${value.length === 1 ? "date" : "dates"} selected`}</p>
      {value.length > 0 && (
        <div className="mdp-chips">
          {value.slice(0, 8).map((k) => <button type="button" className="chipx" key={k} onClick={() => toggle(k)} title="Remove this date">{shortDate(k)} ×</button>)}
          {value.length > 8 && <span className="hint">+{value.length - 8} more</span>}
        </div>
      )}
    </div>
  );
}
