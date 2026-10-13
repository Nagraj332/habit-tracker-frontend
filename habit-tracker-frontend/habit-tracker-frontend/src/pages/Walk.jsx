import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { addDays, api, errMsg, fmt, shortDate } from "../api";
import Icon from "../components/Icon";
import RouteMap from "../components/RouteMap";
import { fmtDur, fmtKm } from "../format";

const R = 100;
const C = 2 * Math.PI * R;

export default function Walk() {
  const { walk, finishWalk, habits, settings, setSettings, walkVersion, say, setError } = useOutletContext();
  const [history, setHistory] = useState([]);
  const [manual, setManual] = useState({ km: "", min: "" });

  const load = () => api.walks().then(setHistory).catch(() => {});
  useEffect(() => { load(); }, [walkVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const idle = walk.status === "idle";
  const goalM = settings.walkGoal * 1000;
  const pct = goalM > 0 ? Math.min(1, walk.distance / goalM) : 0;
  const km = walk.distance / 1000;
  const pace = walk.distance > 20 ? `${fmtDur(walk.elapsed / km)} /km` : "--";
  const speed = walk.distance > 20 && walk.elapsed > 0 ? `${(km / (walk.elapsed / 3600)).toFixed(1)} km/h` : "--";
  const run = settings.walkActivity === "RUN";
  const steps = Math.round(walk.distance / (run ? 1.0 : 0.75));
  const weekStart = fmt(addDays(new Date(), -6));
  const week = history.filter((w) => w.walkDate >= weekStart).reduce((a, w) => a + w.distanceMeters, 0);
  const bars = walk.accuracy == null ? 0 : walk.accuracy <= 10 ? 3 : walk.accuracy <= 20 ? 2 : 1;

  const saveManual = async (e) => {
    e.preventDefault();
    const k = Number(manual.km), m = Number(manual.min);
    if (!(k > 0) || !(m > 0)) return say("Enter a distance and the minutes you walked");
    try {
      await api.createWalk({ habitId: settings.walkHabit ? Number(settings.walkHabit) : null, walkDate: fmt(new Date()), distanceMeters: Math.round(k * 1000), durationSeconds: Math.round(m * 60), activityType: settings.walkActivity });
      setManual({ km: "", min: "" });
      say("Walk added");
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const remove = async (w) => {
    try {
      await api.removeWalk(w.id);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <>
      <header className="top"><div><h1>Walk / Run</h1><p className="sub">Track your distance with GPS while you walk or run.</p></div></header>

      {walk.error && <div className="alert" role="alert">{walk.error}</div>}

      <section className="panel walkhero">
        <div className="ampm seg" role="group" aria-label="Activity">
          {[["WALK", "Walk"], ["RUN", "Run"]].map(([k, label]) => (
            <button key={k} type="button" className={settings.walkActivity === k ? "on" : ""} disabled={!idle} aria-pressed={settings.walkActivity === k} onClick={() => setSettings((s) => ({ ...s, walkActivity: k }))}>{label}</button>
          ))}
        </div>

        <div className="walkring">
          <svg viewBox="0 0 230 230" aria-hidden="true">
            <circle cx="115" cy="115" r={R} fill="none" stroke="var(--empty)" strokeWidth="12" />
            <circle className="walkprog" cx="115" cy="115" r={R} fill="none" stroke="var(--brand)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 115 115)" />
          </svg>
          <div className="ringtext">
            <span className="bigdist">{fmtKm(walk.distance)}</span>
            <span className="muted">km{goalM > 0 ? ` of ${settings.walkGoal}` : ""}</span>
          </div>
        </div>

        <div className="wstats">
          <div><b>{fmtDur(walk.elapsed)}</b><span>Time</span></div>
          <div><b>{pace}</b><span>Pace</span></div>
          <div><b>{speed}</b><span>Speed</span></div>
          <div><b>{steps.toLocaleString()}</b><span>Steps (approx.)</span></div>
        </div>

        <div className="gpsline">
          <span className="gps" aria-hidden="true">{[1, 2, 3].map((n) => <i key={n} className={n <= bars && walk.status === "tracking" ? "on" : ""} style={{ height: 4 + n * 4 }} />)}</span>
          {walk.status === "tracking" ? (walk.accuracy == null ? "Finding your location..." : `GPS ${bars === 3 ? "strong" : bars === 2 ? "fair" : "weak"} (within ${Math.round(walk.accuracy)} m)`) : walk.status === "paused" ? "Paused" : "Ready to go"}
        </div>

        {idle ? (
          <button className="startbtn" onClick={() => walk.start()}>Start</button>
        ) : (
          <div className="hactions center">
            {walk.status === "tracking"
              ? <button className="btn" onClick={() => walk.pause()}><Icon name="pause" size={16} /> Pause</button>
              : <button className="btn primary" onClick={() => walk.resume()}><Icon name="play" size={16} /> Resume</button>}
            <button className="btn primary" onClick={finishWalk}><Icon name="flag" size={16} /> Finish</button>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Route</h2>
        <RouteMap points={walk.points} />
      </section>

      <section className="panel">
        <h2>Settings</h2>
        <div className="setrow tight">
          <label className="fieldline">Goal (km)
            <input type="number" min="0" step="0.5" style={{ width: 90 }} value={settings.walkGoal} onChange={(e) => setSettings((s) => ({ ...s, walkGoal: Math.max(0, Number(e.target.value) || 0) }))} />
          </label>
          <label className="fieldline">Mark habit done
            <select value={settings.walkHabit} onChange={(e) => setSettings((s) => ({ ...s, walkHabit: e.target.value }))}>
              <option value="">None</option>
              {habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>
        </div>
        <p className="hint">When a finished walk reaches the goal, the chosen habit is marked done for today. Keep the screen on while walking, because browsers pause GPS in the background.</p>
      </section>

      <details className="panel manual">
        <summary>Add a walk or run manually</summary>
        <form className="setrow tight" onSubmit={saveManual}>
          <label className="fieldline">Distance (km)<input type="number" min="0" step="0.1" style={{ width: 90 }} value={manual.km} onChange={(e) => setManual((m) => ({ ...m, km: e.target.value }))} /></label>
          <label className="fieldline">Minutes<input type="number" min="0" step="1" style={{ width: 90 }} value={manual.min} onChange={(e) => setManual((m) => ({ ...m, min: e.target.value }))} /></label>
          <button className="btn primary" type="submit">Save walk</button>
        </form>
      </details>

      <section className="panel">
        <div className="setrow"><h2>History</h2><span className="tag" style={{ "--c": "#0f9d8a" }}>{fmtKm(week)} km this week</span></div>
        {history.length === 0 ? <p className="hint">No walks saved yet.</p> : (
          <div className="dayrows">
            {history.slice(0, 10).map((w) => (
              <div className="dayrow" key={w.id} style={{ "--c": "#0f9d8a" }}>
                <b>{fmtKm(w.distanceMeters)} km</b>
                <span className="tag">{w.activityType === "RUN" ? "Run" : "Walk"}</span>
                <span className="muted">{fmtDur(w.durationSeconds)} · {shortDate(w.walkDate)}</span>
                <button className="link danger" onClick={() => remove(w)} aria-label="Delete walk">Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
