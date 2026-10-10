import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, errMsg } from "../api";
import Icon from "../components/Icon";
import TimePicker from "../components/TimePicker";
import { clearTune, loadTune, notify, notifySupported, saveTune, setAlarmVolume, startAlarm, stopAlarm, vibrate, vibrationSupported } from "../alarm";

export default function Reminders() {
  const { habits, settings, setSettings, reload, testAlarm, say, setError } = useOutletContext();
  const [perm, setPerm] = useState(() => (notifySupported() ? Notification.permission : "unsupported"));
  const [tune, setTune] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadTune().then((t) => setTune(t?.name || null)).catch(() => {});
    return () => stopAlarm();
  }, []);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const ask = async () => {
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") notify("Notifications are on", "You will get a pop-up when a habit is still to do.", "welcome");
  };

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!(f.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(f.name))) return setMsg("Please choose an audio file such as MP3 or WAV.");
    if (f.size > 15 * 1024 * 1024) return setMsg("That file is larger than 15 MB. Choose a shorter tune.");
    try {
      await saveTune(f);
      setTune(f.name);
      setMsg(`Alarm tune set to ${f.name}`);
    } catch {
      setMsg("This browser couldn't save the tune. Private windows often block this.");
    }
  };

  const removeTune = async () => {
    stopAlarm();
    await clearTune().catch(() => {});
    setTune(null);
    setMsg("Back to the built-in beep.");
  };

  const preview = async () => {
    if (playing) return stopAlarm();
    const r = await startAlarm({ volume: settings.volume, maxMs: 10000, vibrate: settings.vibrateOn, onStop: () => setPlaying(false) });
    if (r.blocked) setMsg("Your browser blocked the sound. Click the page once and try again.");
    else setPlaying(true);
  };

  const saveTime = async (h, value) => {
    if (!value || value === (h.reminderTime || "")) return;
    try {
      await api.update(h.id, { name: h.name, description: h.description || "", color: h.color, reminderTime: value });
      await reload();
      say(`Reminder set for ${value}`);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const permText = { granted: "Pop-up notifications are on.", denied: "Notifications are blocked. Allow them in your browser's site settings, then reload.", default: "Allow notifications to get a pop-up even when this tab is in the background.", unsupported: "This browser doesn't support notifications. Reminders will still show inside the app." }[perm];

  return (
    <>
      <header className="top"><div><h1>Reminders</h1><p className="sub">Alarms and pop-ups for habits you haven't done yet.</p></div></header>

      <section className="panel">
        <h2>Pop-up notifications</h2>
        <p className="hint">{permText}</p>
        <div className="hactions">
          {perm === "default" && <button className="btn primary" onClick={ask}><Icon name="bell" size={16} /> Allow notifications</button>}
          {perm === "granted" && <button className="btn" onClick={() => notify("Test notification", "This is how a reminder will look.", "test")}>Send test notification</button>}
          <button className="btn" onClick={testAlarm}>Ring test alarm</button>
        </div>
        <p className="hint">Reminders work while Habit Tracker is open in a browser tab. The tab can be in the background, but not closed.</p>
      </section>

      <section className="panel">
        <div className="setrow">
          <div><h2>Alarm sound</h2><p className="hint">Every habit reminder always shows a pop-up. Turn this off for silent reminders.</p></div>
          <label className="switch"><input type="checkbox" checked={settings.alarmOn} onChange={(e) => set("alarmOn", e.target.checked)} aria-label="Alarm sound" /><span /></label>
        </div>

        <h3 className="subh">Alarm tune</h3>
        <p className="hint">{tune ? <>Current tune: <b>{tune}</b></> : "Using the built-in beep."}</p>
        <div className="hactions">
          <label className="btn filebtn"><Icon name="music" size={16} /> Choose from your computer
            <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac" onChange={pick} hidden />
          </label>
          <button className="btn" onClick={preview}><Icon name={playing ? "stop" : "play"} size={16} /> {playing ? "Stop" : "Preview"}</button>
          {tune && <button className="btn danger" onClick={removeTune}><Icon name="trash" size={16} /> Remove</button>}
        </div>
        {msg && <p className="hint" role="status">{msg}</p>}

        <div className="setrow vibrow">
          <div>
            <h3 className="subh" style={{ margin: 0 }}>Vibration</h3>
            <p className="hint">{vibrationSupported() ? "Vibrate with the alarm and with reminder notifications." : "This browser or device doesn't support vibration (iPhones don't)."}</p>
          </div>
          <label className="switch"><input type="checkbox" checked={settings.vibrateOn && vibrationSupported()} disabled={!vibrationSupported()} onChange={(e) => set("vibrateOn", e.target.checked)} aria-label="Vibration" /><span /></label>
        </div>
        {vibrationSupported() && <div className="hactions"><button className="btn" onClick={() => vibrate([300, 150, 300, 150, 600])}>Test vibration</button></div>}

        <div className="setrow tight">
          <label className="fieldline">Volume {Math.round(settings.volume * 100)}%
            <input type="range" min="0.1" max="1" step="0.05" value={settings.volume} onChange={(e) => { const v = Number(e.target.value); set("volume", v); setAlarmVolume(v); }} />
          </label>
          <label className="fieldline">Snooze
            <select value={settings.snooze} onChange={(e) => set("snooze", Number(e.target.value))}>
              {[5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
        </div>
        <p className="hint">The volume buttons on your phone also change how loud the alarm is.</p>
      </section>

      <section className="panel">
        <div className="setrow">
          <div><h2>Daily "still to do" nudge</h2><p className="hint">One pop-up listing every habit that isn't done yet.</p></div>
          <label className="switch"><input type="checkbox" checked={settings.nudgeOn} onChange={(e) => set("nudgeOn", e.target.checked)} aria-label="Daily nudge" /><span /></label>
        </div>
        <div className="fieldline">Nudge time
          <TimePicker value={settings.nudgeTime} onChange={(v) => v && set("nudgeTime", v)} disabled={!settings.nudgeOn} label="Nudge time" />
        </div>
      </section>

      <section className="panel">
        <h2>Habit reminder times</h2>
        <p className="hint">Every habit needs a reminder time.</p>
        {habits.length === 0 ? <p className="hint">No habits yet.</p> : (
          <div className="remlist">
            {habits.map((h) => (
              <div className="remrow" key={h.id} style={{ "--c": h.color }}>
                <span className="dot" /><b>{h.name}</b>
                <TimePicker value={h.reminderTime || ""} onChange={(v) => saveTime(h, v)} label={`Reminder time for ${h.name}`} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
