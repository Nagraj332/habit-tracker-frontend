import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { API_BASE, api, errMsg } from "../api";
import { disablePush, enablePush, getPushStatus } from "../push";
import { getNativeStatus, isNative, openExactAlarmSettings, requestNativePermission, scheduleAll, scheduleTest } from "../native";
import Icon from "../components/Icon";
import TimePicker from "../components/TimePicker";
import { clearTune, loadTune, notify, notifySupported, saveTune, setAlarmVolume, startAlarm, stopAlarm, vibrate, vibrationSupported } from "../alarm";

export default function Reminders() {
  const { habits, settings, setSettings, reload, say, setError } = useOutletContext();
  const [perm, setPerm] = useState(() => (notifySupported() ? Notification.permission : "unsupported"));
  const [tune, setTune] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [msg, setMsg] = useState("");
  const native = isNative();
  const [pushStatus, setPushStatus] = useState("checking");
  const [pushBusy, setPushBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const [ns, setNs] = useState(null);

  // browser / installed website app: alarm alerts sent by the server, so they arrive with the app closed
  useEffect(() => {
    if (native) return;
    getPushStatus().then(setPushStatus).catch(() => setPushStatus("unsupported"));
  }, [native]);
  useEffect(() => {
    if (native || pushStatus !== "on") return;
    api.pushStatus().then(setInfo).catch(() => setInfo(null)); // also wakes a sleeping server
  }, [native, pushStatus]);
  const turnOnAlerts = async () => {
    setPushBusy(true);
    const r = await enablePush();
    setPushBusy(false);
    setPushStatus(await getPushStatus());
    if (r.ok) say("Alarm alerts are on");
    else if (r.reason === "denied") say("Alerts are blocked. Allow notifications in your browser settings.");
    else say(r.message || "Couldn't turn on alarm alerts");
  };
  const turnOffAlerts = async () => {
    setPushBusy(true);
    await disablePush();
    setPushBusy(false);
    setPushStatus(await getPushStatus());
    say("Alarm alerts are off");
  };

  const refreshNative = async () => setNs(await getNativeStatus());
  useEffect(() => {
    if (!native) return;
    refreshNative();
    const onShow = () => { if (document.visibilityState === "visible") refreshNative(); };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [native]);

  const allowNotifications = async () => {
    const r = await requestNativePermission();
    if (r === "granted") await scheduleAll(habits);
    else say("Notifications are blocked. Allow them in your phone's settings for this app.");
    refreshNative();
  };
  const replan = async () => {
    const n = await scheduleAll(habits);
    say(n ? `${n} alarms planned` : "No alarms to plan yet. Add a habit with a reminder time.");
    refreshNative();
  };
  const testInOneMinute = async () => {
    const problem = await scheduleTest();
    say(problem ? `Couldn't set the test: ${problem}` : "Test alarm set for 1 minute from now. Lock the phone and remove the app from recents now.");
    refreshNative();
  };
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

      {native ? (
        <section className="panel">
          <h2>Alarms when the phone sleeps</h2>
          <p className="hint">Your alarms are set on the phone itself, so they go off with the app closed, removed from recents, or the phone asleep. Each alarm rings once a minute for 12 minutes until you open it or mark the habit done.</p>
          <p className="hint">
            {ns ? <>Notifications: <b>{ns.notifications === "granted" ? "allowed" : "not allowed"}</b>. Exact alarms: <b>{ns.exact === "granted" ? "allowed" : "not allowed"}</b>. Alarms planned: <b>{ns.scheduled}</b>.{ns.error ? <> Android refused something: <b>{ns.error}</b></> : null}</> : "Checking..."}
          </p>
          <div className="hactions">
            {ns && ns.notifications !== "granted" && <button className="btn primary" onClick={allowNotifications}><Icon name="bell" size={16} /> Allow notifications</button>}
            {ns && ns.exact !== "granted" && <button className="btn primary" onClick={openExactAlarmSettings}>Allow exact alarms</button>}
            <button className="btn" onClick={replan}>Plan alarms again</button>
            <button className="btn" onClick={testInOneMinute}>Test: ring in 1 minute</button>
          </div>
          <p className="hint">If the test doesn't ring with the phone locked and the app removed from recents, your phone is stopping the app. Open Settings, Apps, Habit Tracker, and set Battery to Unrestricted (or Allow background activity). Turn on Auto-start (Auto launch). In the recent apps screen, lock the Habit Tracker card (lock icon or pull it down) so Clear all doesn't stop it. Keep Do Not Disturb and battery saver off.</p>
        </section>
      ) : (
        <section className="panel">
          <h2>Alarm when the app is closed</h2>
          <p className="hint">{{
            checking: "Checking...",
            on: "On. Your reminders reach this device even when the app is closed, removed from recents, or the phone is locked. The alarm repeats every minute until you open it, mark the habit done, or stop it.",
            off: "Off. Turn this on so reminders reach you even when the app is closed.",
            denied: "Notifications are blocked for this site. Allow them in your browser or phone settings, then come back here.",
            "needs-install": "On iPhone (iOS 16.4 or newer): open this site in Safari, tap Share, then Add to Home Screen. Open the app from the new icon on your Home Screen, then come back here to turn alerts on.",
            unsupported: "This browser can't receive alarm alerts. Use Chrome on Android, or Safari on iPhone and add the app to your Home Screen.",
          }[pushStatus]}</p>
          {pushStatus === "on" && info && (
            <p className="hint">
              Devices registered: {info.devices}. Server time: {info.serverTime} ({info.timezone}).{" "}
              {info.lastCheckSeconds == null ? "The server has not run a reminder check yet." : `Last reminder check: ${info.lastCheckSeconds < 90 ? `${info.lastCheckSeconds} seconds` : `${Math.round(info.lastCheckSeconds / 60)} minutes`} ago.`}{" "}
              {info.lastAlarm ? `Last alarm sent at ${info.lastAlarm} (201 means the phone's push service accepted it).` : "No alarm has been sent from the server yet today."}
            </p>
          )}
          {pushStatus === "on" && (
            <p className="hint">
              Free hosting puts the server to sleep after 15 minutes without visits, and a sleeping server cannot send alarms.
              To keep it awake, set up a free uptime monitor that opens <b>{API_BASE}/health</b> every 5 minutes.
            </p>
          )}
          <div className="hactions">
            {pushStatus === "off" && <button className="btn primary" onClick={turnOnAlerts} disabled={pushBusy}><Icon name="bell" size={16} /> {pushBusy ? "Turning on..." : "Turn on alarm alerts"}</button>}
            {pushStatus === "on" && <button className="btn danger" onClick={turnOffAlerts} disabled={pushBusy}>Turn off</button>}
          </div>
        </section>
      )}

      {!native && (
      <section className="panel">
        <h2>Pop-up notifications</h2>
        <p className="hint">{permText}</p>
        <div className="hactions">
          {perm === "default" && <button className="btn primary" onClick={ask}><Icon name="bell" size={16} /> Allow notifications</button>}
        </div>
        <p className="hint">These pop-ups and the in-app alarm work while Habit Tracker is open.</p>
      </section>
      )}

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

      {!native && (
      <section className="panel">
        <div className="setrow">
          <div><h2>Daily "still to do" nudge</h2><p className="hint">One pop-up listing every habit that isn't done yet.</p></div>
          <label className="switch"><input type="checkbox" checked={settings.nudgeOn} onChange={(e) => set("nudgeOn", e.target.checked)} aria-label="Daily nudge" /><span /></label>
        </div>
        <div className="fieldline">Nudge time
          <TimePicker value={settings.nudgeTime} onChange={(v) => v && set("nudgeTime", v)} disabled={!settings.nudgeOn} label="Nudge time" />
        </div>
      </section>
      )}

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
