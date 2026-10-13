import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, errMsg, getOwnerId, setOwnerId } from "../api";
import { getNativeStatus, isNative, openExactTimingSettings, requestNativePermission, scheduleAll, sendTestNotification } from "../native";
import { notify, notifySupported } from "../notify";
import Icon from "../components/Icon";
import TimePicker from "../components/TimePicker";

export default function Reminders() {
  const { habits, settings, setSettings, reload, say, setError } = useOutletContext();
  const [perm, setPerm] = useState(() => (notifySupported() ? Notification.permission : "unsupported"));
  const native = isNative();
  const [ns, setNs] = useState(null);
  const [code, setCode] = useState("");

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
    say(n ? `${n} reminders planned` : "No reminders to plan yet. Add a habit with a reminder time.");
    refreshNative();
  };
  const testNative = async () => {
    const ok = await sendTestNotification();
    say(ok ? "A test notification will show in a few seconds" : "Couldn't send a test. Allow notifications first.");
  };
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(getOwnerId()); say("Code copied"); } catch { say("Couldn't copy. Select the code and copy it by hand."); }
  };
  const useCode = () => {
    if (!setOwnerId(code)) return say("That code isn't valid. Copy it again from the other device.");
    window.location.reload();
  };

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const ask = async () => {
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") notify("Notifications are on", "You will get a notification when a habit is still to do.", "welcome");
  };

  const saveTime = async (h, value) => {
    if (!value || value === (h.reminderTime || "")) return;
    const dated = (h.scheduledDates || []).length > 0;
    try {
      await api.update(h.id, {
        name: h.name,
        description: h.description || "",
        color: h.color,
        reminderTime: value,
        startDate: dated ? null : h.createdDate, // keep the habit's start day and its chosen dates as they were
        scheduledDates: h.scheduledDates || [],
      });
      await reload();
      say(`Reminder set for ${value}`);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const permText = { granted: "Notifications are on.", denied: "Notifications are blocked. Allow them in your browser's site settings, then reload.", default: "Allow notifications to get a reminder even when this tab is in the background.", unsupported: "This browser doesn't support notifications. Reminders will still show inside the app." }[perm];

  return (
    <>
      <header className="top"><div><h1>Reminders</h1><p className="sub">Notifications for habits you haven't done yet.</p></div></header>

      {native ? (
        <section className="panel">
          <h2>Phone notifications</h2>
          <p className="hint">Each habit with a reminder time sends one notification at that time, even with the app closed. Habits you have already done today are skipped.</p>
          <p className="hint">
            {ns ? <>Notifications: <b>{ns.notifications === "granted" ? "allowed" : "not allowed"}</b>. On-time delivery: <b>{ns.exact === "granted" ? "on" : "off"}</b>. Planned: <b>{ns.scheduled}</b>.</> : "Checking..."}
          </p>
          {ns && ns.channelOff && (
            <p className="hint"><b>Reminders are switched off in Android.</b> Open Settings, Apps, Habit Tracker, Notifications, and turn on "Habit reminders".</p>
          )}
          {ns && ns.error && <p className="hint">Android refused to plan some reminders: {ns.error}</p>}
          {ns && ns.exact !== "granted" && (
            <p className="hint">On-time delivery is off, so Android may show reminders several minutes late, especially when the phone is idle. Turn on "Alarms &amp; reminders" for this app.</p>
          )}
          <div className="hactions">
            {ns && ns.notifications !== "granted" && <button className="btn primary" onClick={allowNotifications}><Icon name="bell" size={16} /> Allow notifications</button>}
            {ns && ns.exact !== "granted" && <button className="btn primary" onClick={openExactTimingSettings}>Allow on-time delivery</button>}
            {ns && ns.notifications === "granted" && <button className="btn" onClick={testNative}>Send a test</button>}
            <button className="btn" onClick={replan}>Plan reminders again</button>
          </div>
          <p className="hint">If reminders arrive late or not at all, open Settings, Apps, Habit Tracker, Battery, and choose Unrestricted. On Samsung phones also remove the app from "Sleeping apps". On Xiaomi, Realme, Oppo, Vivo and similar phones also allow Auto-start for this app, and don't swipe it away or force-stop it, because that cancels its reminders on those phones until you open it again.</p>
        </section>
      ) : (
        <section className="panel">
          <h2>Browser notifications</h2>
          <p className="hint">{permText}</p>
          <div className="hactions">
            {perm === "default" && <button className="btn primary" onClick={ask}><Icon name="bell" size={16} /> Allow notifications</button>}
            {perm === "granted" && <button className="btn" onClick={() => notify("Test notification", "If you can see this, reminders will reach you.", "test")}>Send a test</button>}
          </div>
          <p className="hint">In the browser, reminders only appear while Habit Tracker is open. Install the Android app to get them with the app closed.</p>
        </section>
      )}

      {!native && (
      <section className="panel">
        <div className="setrow">
          <div><h2>Daily "still to do" nudge</h2><p className="hint">One notification listing every habit that isn't done yet.</p></div>
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

      <section className="panel">
        <h2>Link devices</h2>
        <p className="hint">Your habits belong to a private code on this device. To see the same habits on another device (for example the website and the Android app), copy the code here and paste it into the other device. Anyone who has the code can see your habits, so keep it private.</p>
        <p className="hint"><b style={{ wordBreak: "break-all" }}>{getOwnerId()}</b></p>
        <div className="hactions"><button className="btn" onClick={copyCode}>Copy my code</button></div>
        <label className="field">
          <span className="lbl">Use the code from another device</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the code here" autoComplete="off" />
        </label>
        <div className="hactions"><button className="btn primary" onClick={useCode} disabled={!code.trim()}>Use this code</button></div>
      </section>
    </>
  );
}
