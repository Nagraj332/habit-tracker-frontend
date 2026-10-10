import { parseTime, to24 } from "../time";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** 12-hour time picker with AM/PM. value and onChange use 24-hour "HH:mm" (or "" for none). */
export default function TimePicker({ value, onChange, clearable = false, disabled = false, label = "Time" }) {
  const p = parseTime(value);

  return (
    <div className="tpick" role="group" aria-label={label}>
      <select
        value={p ? p.h : ""}
        disabled={disabled}
        aria-label={`${label}, hour`}
        onChange={(e) => {
          const h = Number(e.target.value);
          onChange(h ? to24(h, p ? p.m : 0, p ? p.pm : false) : "");
        }}
      >
        {(clearable || !p) && <option value="">--</option>}
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select value={p ? p.m : ""} disabled={disabled || !p} aria-label={`${label}, minutes`} onChange={(e) => onChange(to24(p.h, Number(e.target.value), p.pm))}>
        {!p && <option value="">--</option>}
        {MINUTES.map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
      </select>
      <div className="ampm">
        <button type="button" className={p && !p.pm ? "on" : ""} disabled={disabled || !p} onClick={() => onChange(to24(p.h, p.m, false))} aria-pressed={Boolean(p && !p.pm)}>AM</button>
        <button type="button" className={p && p.pm ? "on" : ""} disabled={disabled || !p} onClick={() => onChange(to24(p.h, p.m, true))} aria-pressed={Boolean(p && p.pm)}>PM</button>
      </div>
      {clearable && p && !disabled && <button type="button" className="link" onClick={() => onChange("")}>Clear</button>}
    </div>
  );
}
